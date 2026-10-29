package junsik.reservation.service.media;

import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import junsik.reservation.config.MediaStorageProperties;
import junsik.reservation.entity.media.MediaFileCleanup;
import junsik.reservation.repository.MediaFileCleanupRepository;

@Service
public class MediaFileReservation {
	private final MediaFileCleanupRepository repository;
	private final MediaStorageProperties properties;
	public MediaFileReservation(MediaFileCleanupRepository repository, MediaStorageProperties properties) {
		this.repository = repository;
		this.properties = properties;
	}

	// Commit the intent BEFORE opening the owner write transaction or creating any file.
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void reserve(String key) {
		repository.saveAndFlush(new MediaFileCleanup(key, Instant.now().plus(properties.cleanupDelay())));
	}
}
