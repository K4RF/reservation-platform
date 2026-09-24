package junsik.reservation.service.reservation;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.config.ReservationOutboxProperties;
import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.event.reservation.KafkaReservationEventProducer;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationOutboxEventSerializer;
import junsik.reservation.repository.ReservationOutboxEventRepository;

@Service
@ConditionalOnProperty(
		name = {
				"reservation.kafka.enabled",
				"reservation.kafka.outbox.enabled"
		},
		havingValue = "true",
		matchIfMissing = true
)
public class ReservationOutboxPublisher {

	private static final Logger log = LoggerFactory.getLogger(ReservationOutboxPublisher.class);

	private final ReservationOutboxEventRepository outboxEventRepository;
	private final ReservationOutboxEventSerializer serializer;
	private final KafkaReservationEventProducer producer;
	private final ReservationOutboxProperties properties;
	private final Clock clock;

	public ReservationOutboxPublisher(
			ReservationOutboxEventRepository outboxEventRepository,
			ReservationOutboxEventSerializer serializer,
			KafkaReservationEventProducer producer,
			ReservationOutboxProperties properties,
			Clock clock
	) {
		this.outboxEventRepository = outboxEventRepository;
		this.serializer = serializer;
		this.producer = producer;
		this.properties = properties;
		this.clock = clock;
	}

	@Transactional
	public int publishPendingBatch() {
		List<ReservationOutboxEvent> pendingEvents = outboxEventRepository.findBatchByStatusForUpdate(
				ReservationOutboxStatus.PENDING,
				PageRequest.of(0, properties.batchSize())
		);
		int publishedCount = 0;
		for (ReservationOutboxEvent outboxEvent : pendingEvents) {
			if (publish(outboxEvent)) {
				publishedCount++;
			}
		}
		return publishedCount;
	}

	private boolean publish(ReservationOutboxEvent outboxEvent) {
		outboxEvent.recordAttempt(Instant.now(clock));
		try {
			ReservationEvent event = serializer.deserialize(
					outboxEvent.getEventType(),
					outboxEvent.getPayload()
			);
			SendResult<Object, Object> result = producer.send(event).get(
					properties.publishTimeout().toMillis(),
					TimeUnit.MILLISECONDS
			);
			outboxEvent.markPublished(Instant.now(clock));
			log.info(
					"Reservation Outbox event published: eventId={}, eventType={}, reservationId={}, topic={}, partition={}, offset={}",
					outboxEvent.getEventId(),
					outboxEvent.getEventType(),
					outboxEvent.getAggregateId(),
					result.getRecordMetadata().topic(),
					result.getRecordMetadata().partition(),
					result.getRecordMetadata().offset()
			);
			return true;
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			recordFailure(outboxEvent, exception);
			return false;
		} catch (Exception exception) {
			recordFailure(outboxEvent, exception);
			return false;
		}
	}

	private void recordFailure(ReservationOutboxEvent outboxEvent, Exception exception) {
		String message = exception.getMessage() == null
				? exception.getClass().getSimpleName()
				: exception.getClass().getSimpleName() + ": " + exception.getMessage();
		outboxEvent.recordFailure(message);
		log.error(
				"Reservation Outbox event publish failed: eventId={}, eventType={}, reservationId={}, attempts={}",
				outboxEvent.getEventId(),
				outboxEvent.getEventType(),
				outboxEvent.getAggregateId(),
				outboxEvent.getPublishAttempts(),
				exception
		);
	}
}
