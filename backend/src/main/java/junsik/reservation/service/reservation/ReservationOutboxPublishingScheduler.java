package junsik.reservation.service.reservation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
		name = {
				"reservation.kafka.enabled",
				"reservation.kafka.outbox.enabled",
				"reservation.kafka.outbox.scheduling-enabled"
		},
		havingValue = "true",
		matchIfMissing = true
)
public class ReservationOutboxPublishingScheduler {

	private final ReservationOutboxPublisher outboxPublisher;

	public ReservationOutboxPublishingScheduler(ReservationOutboxPublisher outboxPublisher) {
		this.outboxPublisher = outboxPublisher;
	}

	@Scheduled(fixedDelayString = "${reservation.kafka.outbox.publish-interval:1s}")
	public void publishPendingEvents() {
		outboxPublisher.publishPendingBatch();
	}
}
