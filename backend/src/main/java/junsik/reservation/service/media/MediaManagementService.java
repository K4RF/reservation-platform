package junsik.reservation.service.media;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import junsik.reservation.dto.media.request.MediaMetadataRequest;
import junsik.reservation.dto.media.response.MediaAlbumResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.entity.media.MediaFileCleanup;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.MediaErrorCode;
import junsik.reservation.enums.MediaOwnerType;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.MediaFileCleanupRepository;
import junsik.reservation.repository.RoomRepository;

@Service
public class MediaManagementService {
	private final CatalogMediaRepository media;
	private final AccommodationRepository accommodations;
	private final RoomRepository rooms;
	private final MediaFileCleanupRepository cleanup;
	private final LocalMediaStorage storage;
	private final CatalogMediaCacheEviction eviction;

	public MediaManagementService(CatalogMediaRepository media, AccommodationRepository accommodations,
			RoomRepository rooms, MediaFileCleanupRepository cleanup, LocalMediaStorage storage, CatalogMediaCacheEviction eviction) {
		this.media = media;
		this.accommodations = accommodations;
		this.rooms = rooms;
		this.cleanup = cleanup;
		this.storage = storage;
		this.eviction = eviction;
	}

	@Transactional(readOnly = true)
	public MediaAlbumResponse get(MediaOwnerType type, Long id) {
		if (type == MediaOwnerType.ACCOMMODATION ? !accommodations.existsById(id) : !rooms.existsById(id)) {
			throw new BusinessException(type == MediaOwnerType.ACCOMMODATION ? AccommodationErrorCode.NOT_FOUND : RoomErrorCode.NOT_FOUND);
		}
		return response(type, id, images(type, id));
	}

	@Transactional
	public MediaAlbumResponse upload(MediaOwnerType type, Long id, String expected, String key,
			ImageUploadValidator.ValidatedImage image, MediaMetadataRequest metadata, Long replaceId) {
		Object owner = lockOwner(type, id);
		List<CatalogMedia> album = images(type, id);
		checkRevision(type, id, album, expected);
		CatalogMedia replaced = replaceId == null ? null : member(album, replaceId);
		if (replaced == null && album.size() >= CatalogMediaReadService.GALLERY_LIMIT) {
			throw new BusinessException(MediaErrorCode.LIMIT_EXCEEDED);
		}
		// Holding the durable intent row prevents the cleaner from touching an in-flight file.
		MediaFileCleanup reservation = cleanup.lockByKey(key)
				.orElseThrow(() -> new BusinessException(MediaErrorCode.UPLOAD_EXPIRED));
		try { storage.write(key, image.bytes()); }
		catch (IOException exception) { throw new BusinessException(MediaErrorCode.STORAGE_UNAVAILABLE, exception); }
		int index = replaced == null ? album.size() : album.indexOf(replaced);
		CatalogMedia created = type == MediaOwnerType.ACCOMMODATION
				? CatalogMedia.forAccommodation((Accommodation) owner, key, image.format(), metadata.altText(),
						image.width(), image.height(), image.bytes().length, index, metadata.source(), metadata.rightsRecord())
				: CatalogMedia.forRoom((Room) owner, key, image.format(), metadata.altText(),
						image.width(), image.height(), image.bytes().length, index, metadata.source(), metadata.rightsRecord());
		media.saveAndFlush(created);
		if (replaced == null) { album.add(created); }
		else {
			album.set(index, created);
			queueDeletion(replaced);
		}
		cleanup.delete(reservation); // Commit claims the file; rollback leaves the precommitted intent.
		return finish(type, id, album);
	}

	@Transactional
	public MediaAlbumResponse updateMetadata(MediaOwnerType type, Long id, Long mediaId, String expected, MediaMetadataRequest request) {
		lockOwner(type, id);
		List<CatalogMedia> album = images(type, id);
		checkRevision(type, id, album, expected);
		member(album, mediaId).updateMetadata(request.altText(), request.source(), request.rightsRecord());
		return finish(type, id, album);
	}

	@Transactional
	public MediaAlbumResponse representative(MediaOwnerType type, Long id, Long mediaId, String expected) {
		lockOwner(type, id);
		List<CatalogMedia> album = images(type, id);
		checkRevision(type, id, album, expected);
		CatalogMedia chosen = member(album, mediaId);
		album.remove(chosen);
		album.addFirst(chosen);
		return finish(type, id, album);
	}

	@Transactional
	public MediaAlbumResponse reorder(MediaOwnerType type, Long id, String expected, List<Long> ids) {
		lockOwner(type, id);
		List<CatalogMedia> album = images(type, id);
		checkRevision(type, id, album, expected);
		if (ids == null || ids.size() != album.size() || new HashSet<>(ids).size() != ids.size()
				|| !new HashSet<>(ids).equals(new HashSet<>(album.stream().map(CatalogMedia::getId).toList()))) {
			throw new BusinessException(MediaErrorCode.INVALID_ORDER);
		}
		return finish(type, id, new ArrayList<>(ids.stream().map(mediaId -> member(album, mediaId)).toList()));
	}

	@Transactional
	public MediaAlbumResponse delete(MediaOwnerType type, Long id, Long mediaId, String expected) {
		lockOwner(type, id);
		List<CatalogMedia> album = images(type, id);
		checkRevision(type, id, album, expected);
		CatalogMedia removed = member(album, mediaId);
		album.remove(removed);
		queueDeletion(removed);
		return finish(type, id, album);
	}

	private void queueDeletion(CatalogMedia removed) {
		cleanup.save(new MediaFileCleanup(removed.getStorageKey(), Instant.now()));
		media.delete(removed);
	}

	private MediaAlbumResponse finish(MediaOwnerType type, Long id, List<CatalogMedia> album) {
		for (int index = 0; index < album.size(); index++) { album.get(index).changeSortOrder(index); }
		media.flush();
		if (type == MediaOwnerType.ACCOMMODATION) { eviction.accommodationChanged(id); }
		else { eviction.roomChanged(id); }
		return response(type, id, album);
	}

	private Object lockOwner(MediaOwnerType type, Long id) {
		return type == MediaOwnerType.ACCOMMODATION
				? accommodations.lockForMedia(id).orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND))
				: rooms.lockForMedia(id).orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}

	private List<CatalogMedia> images(MediaOwnerType type, Long id) {
		List<CatalogMedia> result = type == MediaOwnerType.ACCOMMODATION
				? media.findAccommodationImages(List.of(id), 21) : media.findRoomImages(List.of(id), 21);
		if (result.size() > CatalogMediaReadService.GALLERY_LIMIT) { throw new BusinessException(MediaErrorCode.LIMIT_EXCEEDED); }
		return new ArrayList<>(result);
	}

	private static CatalogMedia member(List<CatalogMedia> images, Long mediaId) {
		return images.stream().filter(image -> Objects.equals(image.getId(), mediaId)).findFirst()
				.orElseThrow(() -> new BusinessException(MediaErrorCode.NOT_FOUND));
	}

	private static MediaAlbumResponse response(MediaOwnerType type, Long id, List<CatalogMedia> album) {
		return new MediaAlbumResponse(type, id, revision(type, id, album), album.stream().map(MediaAlbumResponse.Item::from).toList());
	}

	private static void checkRevision(MediaOwnerType type, Long id, List<CatalogMedia> album, String expected) {
		if (expected == null || !expected.matches("\"[a-f0-9]{64}\"")) { throw new BusinessException(MediaErrorCode.INVALID_REVISION); }
		if (!expected.equals("\"" + revision(type, id, album) + "\"")) { throw new BusinessException(MediaErrorCode.STALE_ALBUM); }
	}

	private static String revision(MediaOwnerType type, Long id, List<CatalogMedia> album) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			update(digest, type.name());
			update(digest, id.toString());
			for (CatalogMedia image : album) {
				update(digest, image.getId().toString());
				update(digest, Integer.toString(image.getSortOrder()));
				update(digest, image.getAltText());
				update(digest, image.getSource());
				update(digest, image.getRightsRecord());
			}
			return HexFormat.of().formatHex(digest.digest());
		} catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
	}

	private static void update(MessageDigest digest, String value) {
		byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
		digest.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());
		digest.update(bytes);
	}
}
