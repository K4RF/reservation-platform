package junsik.reservation.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.kafka.outbox")
public record ReservationOutboxProperties(
		boolean enabled,
		boolean schedulingEnabled,
		Duration publishInterval,
		int batchSize,
		Duration publishTimeout
) {

	public ReservationOutboxProperties {
		if (publishInterval == null || publishInterval.isNegative() || publishInterval.isZero()) {
			throw new IllegalArgumentException("reservation.kafka.outbox.publish-interval must be positive");
		}
		if (batchSize < 1) {
			throw new IllegalArgumentException("reservation.kafka.outbox.batch-size must be positive");
		}
		if (publishTimeout == null || publishTimeout.isNegative() || publishTimeout.isZero()) {
			throw new IllegalArgumentException("reservation.kafka.outbox.publish-timeout must be positive");
		}
	}
}
