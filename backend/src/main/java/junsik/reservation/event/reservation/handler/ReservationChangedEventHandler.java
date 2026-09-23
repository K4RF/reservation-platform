package junsik.reservation.event.reservation.handler;

import org.springframework.stereotype.Component;

import junsik.reservation.event.reservation.ReservationChangedEvent;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@Component
public class ReservationChangedEventHandler implements ReservationEventHandler {

	private final ReservationEventAuditLogService auditLogService;

	public ReservationChangedEventHandler(ReservationEventAuditLogService auditLogService) {
		this.auditLogService = auditLogService;
	}

	@Override
	public ReservationEventType eventType() {
		return ReservationEventType.RESERVATION_CHANGED;
	}

	@Override
	public void handle(ReservationEvent event) {
		if (!(event instanceof ReservationChangedEvent changedEvent)) {
			throw new IllegalArgumentException("RESERVATION_CHANGED requires ReservationChangedEvent");
		}
		auditLogService.recordChanged(changedEvent);
	}
}
