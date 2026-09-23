package junsik.reservation.event.reservation;

import java.util.Objects;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class SpringReservationEventPublisher implements ReservationEventPublisher {

	private final ApplicationEventPublisher applicationEventPublisher;

	public SpringReservationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
		this.applicationEventPublisher = applicationEventPublisher;
	}

	@Override
	public void publish(ReservationEvent event) {
		applicationEventPublisher.publishEvent(Objects.requireNonNull(event, "event must not be null"));
	}
}
