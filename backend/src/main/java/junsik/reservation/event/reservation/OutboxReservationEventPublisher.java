package junsik.reservation.event.reservation;

import java.util.Objects;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.repository.ReservationOutboxEventRepository;

@Component
public class OutboxReservationEventPublisher implements ReservationEventPublisher {

	private final ReservationOutboxEventRepository outboxEventRepository;
	private final ReservationOutboxEventSerializer serializer;

	public OutboxReservationEventPublisher(
			ReservationOutboxEventRepository outboxEventRepository,
			ReservationOutboxEventSerializer serializer
	) {
		this.outboxEventRepository = outboxEventRepository;
		this.serializer = serializer;
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public void publish(ReservationEvent event) {
		ReservationEvent requiredEvent = Objects.requireNonNull(event, "event must not be null");
		outboxEventRepository.save(ReservationOutboxEvent.create(
				requiredEvent,
				serializer.serialize(requiredEvent)
		));
	}
}
