package junsik.reservation.event.reservation;

import java.time.Instant;
import java.util.Objects;

public record ReservationChangedEvent(
		ReservationEventMetadata metadata,
		ReservationChangedPayload payload
) implements ReservationEvent {

	public ReservationChangedEvent {
		ReservationEventValidation.requireEventType(
				metadata,
				ReservationEventType.RESERVATION_CHANGED
		);
		Objects.requireNonNull(payload, "payload must not be null");
	}

	public static ReservationChangedEvent create(
			Long reservationId,
			Instant occurredAt,
			ReservationChangedPayload payload
	) {
		return new ReservationChangedEvent(
				ReservationEventMetadata.create(
						ReservationEventType.RESERVATION_CHANGED,
						reservationId,
						occurredAt
				),
				payload
		);
	}
}
