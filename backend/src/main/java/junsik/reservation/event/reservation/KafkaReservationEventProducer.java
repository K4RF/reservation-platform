package junsik.reservation.event.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import junsik.reservation.config.ReservationKafkaProperties;

@Component
@ConditionalOnProperty(
		name = "reservation.kafka.enabled",
		havingValue = "true",
		matchIfMissing = true
)
public class KafkaReservationEventProducer {

	private static final Logger log = LoggerFactory.getLogger(KafkaReservationEventProducer.class);

	private final KafkaTemplate<Object, Object> kafkaTemplate;
	private final ReservationKafkaProperties properties;

	public KafkaReservationEventProducer(
			KafkaTemplate<Object, Object> kafkaTemplate,
			ReservationKafkaProperties properties
	) {
		this.kafkaTemplate = kafkaTemplate;
		this.properties = properties;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void publishAfterCommit(ReservationEvent event) {
		String topic = properties.reservationTopic();
		String key = event.partitionKey();
		try {
			kafkaTemplate.send(topic, key, event)
					.whenComplete((result, exception) -> handleResult(event, result, exception));
		} catch (RuntimeException exception) {
			logFailure(event, exception);
		}
	}

	private void handleResult(
			ReservationEvent event,
			SendResult<Object, Object> result,
			Throwable exception
	) {
		if (exception != null) {
			logFailure(event, exception);
			return;
		}
		log.info(
				"Reservation event sent: eventId={}, eventType={}, reservationId={}, topic={}, partition={}, offset={}",
				event.metadata().eventId(),
				event.metadata().eventType(),
				event.metadata().aggregateId(),
				result.getRecordMetadata().topic(),
				result.getRecordMetadata().partition(),
				result.getRecordMetadata().offset()
		);
	}

	private void logFailure(ReservationEvent event, Throwable exception) {
		log.error(
				"Reservation event send failed: eventId={}, eventType={}, reservationId={}, topic={}",
				event.metadata().eventId(),
				event.metadata().eventType(),
				event.metadata().aggregateId(),
				properties.reservationTopic(),
				exception
		);
	}
}
