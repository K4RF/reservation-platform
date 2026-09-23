package junsik.reservation.event.reservation.handler;

import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;

public interface ReservationEventHandler {

	ReservationEventType eventType();

	void handle(ReservationEvent event);
}
