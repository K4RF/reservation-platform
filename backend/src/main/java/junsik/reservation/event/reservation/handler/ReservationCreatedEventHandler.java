package junsik.reservation.event.reservation.handler;

import org.springframework.stereotype.Component;

import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@Component
public class ReservationCreatedEventHandler implements ReservationEventHandler {

	private final ReservationEventAuditLogService auditLogService;

	public ReservationCreatedEventHandler(ReservationEventAuditLogService auditLogService) {
		this.auditLogService = auditLogService;
	}

	@Override
	public ReservationEventType eventType() {
		return ReservationEventType.RESERVATION_CREATED;
	}

	@Override
	public void handle(ReservationEvent event) {
		if (!(event instanceof ReservationCreatedEvent createdEvent)) {
			throw new IllegalArgumentException("RESERVATION_CREATED requires ReservationCreatedEvent");
		}
		auditLogService.recordCreated(createdEvent);
	}
}
