package junsik.reservation.service.media;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import junsik.reservation.dto.media.request.MediaMetadataRequest;
import junsik.reservation.dto.media.response.MediaAlbumResponse;
import junsik.reservation.enums.MediaOwnerType;

@Service
public class MediaUploadCoordinator {
	private static final Logger log = LoggerFactory.getLogger(MediaUploadCoordinator.class);
	private final ImageUploadValidator validator;
	private final MediaFileReservation reservations;
	private final MediaManagementService management;
	private final MediaFileCleanupService cleanup;

	public MediaUploadCoordinator(ImageUploadValidator validator, MediaFileReservation reservations,
			MediaManagementService management, MediaFileCleanupService cleanup) {
		this.validator = validator;
		this.reservations = reservations;
		this.management = management;
		this.cleanup = cleanup;
	}

	// Avoid nested connection acquisition while other writers wait on the same owner row.
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public MediaAlbumResponse upload(MediaOwnerType type, Long id, String expected, MultipartFile file,
			MediaMetadataRequest metadata, Long replaceId) {
		var image = validator.validate(file);
		String key = UUID.randomUUID() + "." + image.format().getExtension();
		reservations.reserve(key);
		try { return management.upload(type, id, expected, key, image, metadata, replaceId); }
		catch (RuntimeException failure) {
			try { cleanup.processFailedUpload(key); }
			catch (RuntimeException cleanupFailure) {
				log.warn("Media cleanup intent remains for later recovery. cause={}", cleanupFailure.getClass().getSimpleName());
			}
			throw failure;
		}
	}
}
