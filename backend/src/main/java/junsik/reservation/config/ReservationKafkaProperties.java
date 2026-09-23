package junsik.reservation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.kafka")
public record ReservationKafkaProperties(
		boolean enabled,
		String reservationTopic,
		int partitions,
		short replicationFactor
) {

	public ReservationKafkaProperties {
		if (reservationTopic == null || reservationTopic.isBlank()) {
			throw new IllegalArgumentException("reservation.kafka.reservation-topic must not be blank");
		}
		if (partitions < 1) {
			throw new IllegalArgumentException("reservation.kafka.partitions must be positive");
		}
		if (replicationFactor < 1) {
			throw new IllegalArgumentException("reservation.kafka.replication-factor must be positive");
		}
		reservationTopic = reservationTopic.trim();
	}
}
