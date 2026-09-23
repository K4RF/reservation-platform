package junsik.reservation.event.reservation.handler;

import org.springframework.stereotype.Component;

import junsik.reservation.event.reservation.ReservationCancelledEvent;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@Component
public class ReservationCancelledEventHandler implements ReservationEventHandler {

	private final ReservationEventAuditLogService auditLogService;

	public ReservationCancelledEventHandler(ReservationEventAuditLogService auditLogService) {
		this.auditLogService = auditLogService;
	}

	@Override
	public ReservationEventType eventType() {
		return ReservationEventType.RESERVATION_CANCELLED;
	}

	@Override
	public void handle(ReservationEvent event) {
		if (!(event instanceof ReservationCancelledEvent cancelledEvent)) {
			throw new IllegalArgumentException("RESERVATION_CANCELLED requires ReservationCancelledEvent");
		}
		auditLogService.recordCancelled(cancelledEvent);
	}
}
