package junsik.reservation.config;

import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("reservation.media")
public record MediaStorageProperties(
		@DefaultValue(".local/media") Path root,
		@DefaultValue("PT1M") Duration cleanupDelay
) {
	public MediaStorageProperties {
		if (root == null || root.toString().isBlank() || cleanupDelay == null || cleanupDelay.isNegative()) {
			throw new IllegalArgumentException("Invalid Media storage configuration");
		}
	}
}
