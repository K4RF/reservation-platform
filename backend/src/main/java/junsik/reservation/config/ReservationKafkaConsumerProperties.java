package junsik.reservation.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.kafka.consumer")
public record ReservationKafkaConsumerProperties(
		String deadLetterTopic,
		int maxRetries,
		Duration retryBackoff,
		Duration deadLetterPublishTimeout
) {

	public ReservationKafkaConsumerProperties {
		if (deadLetterTopic == null || deadLetterTopic.isBlank()) {
			throw new IllegalArgumentException(
					"reservation.kafka.consumer.dead-letter-topic must not be blank"
			);
		}
		if (maxRetries < 0) {
			throw new IllegalArgumentException(
					"reservation.kafka.consumer.max-retries must not be negative"
			);
		}
		if (retryBackoff == null || retryBackoff.isNegative()) {
			throw new IllegalArgumentException(
					"reservation.kafka.consumer.retry-backoff must not be negative"
			);
		}
		if (deadLetterPublishTimeout == null
				|| deadLetterPublishTimeout.isZero()
				|| deadLetterPublishTimeout.isNegative()) {
			throw new IllegalArgumentException(
					"reservation.kafka.consumer.dead-letter-publish-timeout must be positive"
			);
		}
		deadLetterTopic = deadLetterTopic.trim();
	}
}
