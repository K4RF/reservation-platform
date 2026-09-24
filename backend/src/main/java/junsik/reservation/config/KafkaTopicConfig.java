package junsik.reservation.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@ConditionalOnProperty(
		name = "reservation.kafka.enabled",
		havingValue = "true",
		matchIfMissing = true
)
@EnableConfigurationProperties({
		ReservationKafkaProperties.class,
		ReservationKafkaConsumerProperties.class
})
public class KafkaTopicConfig {

	@Bean
	NewTopic reservationEventsTopic(ReservationKafkaProperties properties) {
		return TopicBuilder.name(properties.reservationTopic())
				.partitions(properties.partitions())
				.replicas(properties.replicationFactor())
				.build();
	}

	@Bean
	NewTopic reservationEventsDeadLetterTopic(
			ReservationKafkaProperties kafkaProperties,
			ReservationKafkaConsumerProperties consumerProperties
	) {
		if (kafkaProperties.reservationTopic().equals(consumerProperties.deadLetterTopic())) {
			throw new IllegalArgumentException(
					"Reservation event topic and dead letter topic must be different"
			);
		}
		return TopicBuilder.name(consumerProperties.deadLetterTopic())
				.partitions(kafkaProperties.partitions())
				.replicas(kafkaProperties.replicationFactor())
				.build();
	}
}
