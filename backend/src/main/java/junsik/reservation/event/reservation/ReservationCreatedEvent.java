package junsik.reservation.event.reservation;

import java.time.Instant;
import java.util.Objects;

public record ReservationCreatedEvent(
		ReservationEventMetadata metadata,
		ReservationCreatedPayload payload
) implements ReservationEvent {

	public ReservationCreatedEvent {
		ReservationEventValidation.requireEventType(
				metadata,
				ReservationEventType.RESERVATION_CREATED
		);
		Objects.requireNonNull(payload, "payload must not be null");
	}

	public static ReservationCreatedEvent create(
			Long reservationId,
			Instant occurredAt,
			ReservationCreatedPayload payload
	) {
		return new ReservationCreatedEvent(
				ReservationEventMetadata.create(
						ReservationEventType.RESERVATION_CREATED,
						reservationId,
						occurredAt
				),
				payload
		);
	}
}
