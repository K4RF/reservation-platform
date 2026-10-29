package junsik.reservation.service.media;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import junsik.reservation.config.MediaStorageProperties;
import junsik.reservation.entity.media.MediaFileCleanup;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.MediaFileCleanupRepository;

@Service
public class MediaFileCleanupService {
	private static final Logger log = LoggerFactory.getLogger(MediaFileCleanupService.class);
	private final MediaFileCleanupRepository tasks;
	private final CatalogMediaRepository media;
	private final LocalMediaStorage storage;
	private final MediaStorageProperties properties;

	public MediaFileCleanupService(MediaFileCleanupRepository tasks, CatalogMediaRepository media,
			LocalMediaStorage storage, MediaStorageProperties properties) {
		this.tasks = tasks;
		this.media = media;
		this.storage = storage;
		this.properties = properties;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
	public CleanupResult processDue() {
		int completed = 0;
		int failed = 0;
		// Stable PK order also prevents two cleaners with different candidate snapshots from deadlocking.
		for (String key : tasks.findDueKeys(Instant.now(), PageRequest.of(0, 20)).stream().sorted().toList()) {
			MediaFileCleanup task = tasks.lockByKey(key).orElse(null);
			if (task == null || task.getNextAttemptAt().isAfter(Instant.now())) { continue; }
			if (process(task)) { completed++; } else { failed++; }
		}
		return new CleanupResult(completed, failed);
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
	public void processFailedUpload(String key) {
		tasks.lockByKey(key).ifPresent(this::process);
	}

	private boolean process(MediaFileCleanup task) {
		try {
			// A committed reference wins. Never delete a live file even after an ambiguous commit result.
			if (!media.existsByStorageKey(task.getStorageKey())) { storage.delete(task.getStorageKey()); }
			tasks.delete(task);
			return true;
		} catch (java.io.IOException | IllegalArgumentException exception) {
			task.failed(exception.getClass().getSimpleName(), Instant.now().plus(properties.cleanupDelay()));
			log.warn("Media file cleanup retained for retry. cause={}", exception.getClass().getSimpleName());
			return false;
		}
	}

	public record CleanupResult(int completed, int failed) { }
}
