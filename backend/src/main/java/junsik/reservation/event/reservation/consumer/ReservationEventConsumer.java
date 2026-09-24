package junsik.reservation.event.reservation.consumer;

import java.util.Objects;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.service.reservation.ReservationEventIdempotencyService;
import junsik.reservation.service.reservation.ReservationEventProcessingResult;

@Component
@ConditionalOnProperty(
		name = "reservation.kafka.enabled",
		havingValue = "true",
		matchIfMissing = true
)
public class ReservationEventConsumer {

	private static final Logger log = LoggerFactory.getLogger(ReservationEventConsumer.class);

	private final ReservationEventIdempotencyService idempotencyService;

	public ReservationEventConsumer(ReservationEventIdempotencyService idempotencyService) {
		this.idempotencyService = idempotencyService;
	}

	@KafkaListener(
			topics = "${reservation.kafka.reservation-topic}",
			groupId = "${spring.kafka.consumer.group-id}"
	)
	public void consume(ConsumerRecord<String, ReservationEvent> record) {
		ReservationEvent event = Objects.requireNonNull(record.value(), "event must not be null");
		validateKey(record.key(), event);
		log.info(
				"Reservation event received: eventId={}, eventType={}, reservationId={}, topic={}, partition={}, offset={}",
				event.metadata().eventId(),
				event.metadata().eventType(),
				event.metadata().aggregateId(),
				record.topic(),
				record.partition(),
				record.offset()
		);

		try {
			ReservationEventProcessingResult result = idempotencyService.process(event);
			if (result == ReservationEventProcessingResult.DUPLICATE) {
				log.info(
						"Duplicate reservation event skipped: eventId={}, eventType={}, reservationId={}",
						event.metadata().eventId(),
						event.metadata().eventType(),
						event.metadata().aggregateId()
				);
				return;
			}
			log.info(
					"Reservation event processed: eventId={}, eventType={}, reservationId={}",
					event.metadata().eventId(),
					event.metadata().eventType(),
					event.metadata().aggregateId()
			);
		} catch (RuntimeException exception) {
			log.error(
					"Reservation event processing failed: eventId={}, eventType={}, reservationId={}",
					event.metadata().eventId(),
					event.metadata().eventType(),
					event.metadata().aggregateId(),
					exception
			);
			throw exception;
		}
	}

	private void validateKey(String key, ReservationEvent event) {
		if (!event.partitionKey().equals(key)) {
			throw new IllegalArgumentException("Kafka key must match the Reservation aggregate ID");
		}
	}
}
