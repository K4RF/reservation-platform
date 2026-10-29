package junsik.reservation.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import junsik.reservation.service.media.MediaFileCleanupService;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "reservation.media.cleanup-scheduling-enabled", havingValue = "true", matchIfMissing = true)
public class MediaCleanupSchedulingConfig {
	private final MediaFileCleanupService cleanup;
	public MediaCleanupSchedulingConfig(MediaFileCleanupService cleanup) { this.cleanup = cleanup; }

	@Scheduled(fixedDelayString = "${reservation.media.cleanup-interval:PT1M}", initialDelayString = "${reservation.media.cleanup-interval:PT1M}")
	public void cleanFiles() { cleanup.processDue(); }
}
