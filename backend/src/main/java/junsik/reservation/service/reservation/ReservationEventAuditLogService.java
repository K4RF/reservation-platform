package junsik.reservation.service.reservation;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import junsik.reservation.event.reservation.ReservationCancelledEvent;
import junsik.reservation.event.reservation.ReservationChangedEvent;
import junsik.reservation.event.reservation.ReservationCreatedEvent;

@Service
public class ReservationEventAuditLogService {

	private static final Logger log = LoggerFactory.getLogger(ReservationEventAuditLogService.class);

	public void recordCreated(ReservationCreatedEvent event) {
		record(event.metadata().eventId(), event.metadata().eventType().name(),
				event.metadata().aggregateId(), event.payload().reservationNumber());
	}

	public void recordChanged(ReservationChangedEvent event) {
		record(event.metadata().eventId(), event.metadata().eventType().name(),
				event.metadata().aggregateId(), event.payload().reservationNumber());
	}

	public void recordCancelled(ReservationCancelledEvent event) {
		record(event.metadata().eventId(), event.metadata().eventType().name(),
				event.metadata().aggregateId(), event.payload().reservationNumber());
	}

	private void record(UUID eventId, String eventType, Long reservationId, String reservationNumber) {
		log.info(
				"Reservation audit event: eventId={}, eventType={}, reservationId={}, reservationNumber={}",
				eventId,
				eventType,
				reservationId,
				reservationNumber
		);
	}
}
