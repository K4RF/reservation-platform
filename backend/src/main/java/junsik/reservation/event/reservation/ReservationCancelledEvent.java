package junsik.reservation.event.reservation;

import java.time.Instant;
import java.util.Objects;

public record ReservationCancelledEvent(
		ReservationEventMetadata metadata,
		ReservationCancelledPayload payload
) implements ReservationEvent {

	public ReservationCancelledEvent {
		ReservationEventValidation.requireEventType(
				metadata,
				ReservationEventType.RESERVATION_CANCELLED
		);
		Objects.requireNonNull(payload, "payload must not be null");
	}

	public static ReservationCancelledEvent create(
			Long reservationId,
			Instant occurredAt,
			ReservationCancelledPayload payload
	) {
		return new ReservationCancelledEvent(
				ReservationEventMetadata.create(
						ReservationEventType.RESERVATION_CANCELLED,
						reservationId,
						occurredAt
				),
				payload
		);
	}
}
