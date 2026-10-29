package junsik.reservation.service.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import junsik.reservation.config.MediaStorageProperties;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.enums.MediaErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.CatalogMediaRepository;

@Service
@EnableConfigurationProperties(MediaStorageProperties.class)
public class MediaContentService {

	private final CatalogMediaRepository repository;
	private final MediaStorageProperties properties;

	public MediaContentService(CatalogMediaRepository repository, MediaStorageProperties properties) {
		this.repository = repository;
		this.properties = properties;
	}

	public Content read(Long mediaId) {
		CatalogMedia media = repository.findById(mediaId)
				.orElseThrow(() -> new BusinessException(MediaErrorCode.NOT_FOUND));
		// No URL fetches or user-supplied paths. Storage objects are immutable UUID files.
		CatalogMedia.validateStorageKey(media.getStorageKey(), media.getFormat());
		try {
			Path root = properties.root().toAbsolutePath().normalize().toRealPath();
			Path file = root.resolve(media.getStorageKey());
			if (Files.isSymbolicLink(file) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)
					|| !file.toRealPath().getParent().equals(root) || Files.size(file) != media.getByteSize()) {
				throw new BusinessException(MediaErrorCode.NOT_FOUND);
			}
			byte[] bytes;
			try (var input = Files.newInputStream(file)) {
				bytes = input.readNBytes((int) CatalogMedia.MAX_BYTES + 1);
			}
			if (bytes.length != media.getByteSize() || bytes.length > CatalogMedia.MAX_BYTES) {
				throw new BusinessException(MediaErrorCode.NOT_FOUND);
			}
			return new Content(bytes, media.getFormat().getContentType());
		} catch (NoSuchFileException exception) {
			throw new BusinessException(MediaErrorCode.NOT_FOUND);
		} catch (IOException exception) {
			throw new BusinessException(MediaErrorCode.STORAGE_UNAVAILABLE, exception);
		}
	}

	public record Content(byte[] bytes, String contentType) { }
}
