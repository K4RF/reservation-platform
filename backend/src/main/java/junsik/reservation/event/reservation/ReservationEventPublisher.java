package junsik.reservation.event.reservation;

public interface ReservationEventPublisher {

	void publish(ReservationEvent event);
}
