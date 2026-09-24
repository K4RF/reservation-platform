package junsik.reservation.event.reservation;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import junsik.reservation.config.ReservationKafkaProperties;

@Component
@ConditionalOnProperty(
		name = "reservation.kafka.enabled",
		havingValue = "true",
		matchIfMissing = true
)
public class KafkaReservationEventProducer {

	private final KafkaTemplate<Object, Object> kafkaTemplate;
	private final ReservationKafkaProperties properties;

	public KafkaReservationEventProducer(
			KafkaTemplate<Object, Object> kafkaTemplate,
			ReservationKafkaProperties properties
	) {
		this.kafkaTemplate = kafkaTemplate;
		this.properties = properties;
	}

	public CompletableFuture<SendResult<Object, Object>> send(ReservationEvent event) {
		ReservationEvent requiredEvent = Objects.requireNonNull(event, "event must not be null");
		return kafkaTemplate.send(
				properties.reservationTopic(),
				requiredEvent.partitionKey(),
				requiredEvent
		);
	}
}
