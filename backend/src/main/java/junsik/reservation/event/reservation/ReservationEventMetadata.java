package junsik.reservation.event.reservation;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record ReservationEventMetadata(
		UUID eventId,
		Instant occurredAt,
		String aggregateType,
		Long aggregateId,
		ReservationEventType eventType,
		int schemaVersion
) {

	public static final String RESERVATION_AGGREGATE = "RESERVATION";
	public static final int CURRENT_SCHEMA_VERSION = 1;

	public ReservationEventMetadata {
		Objects.requireNonNull(eventId, "eventId must not be null");
		Objects.requireNonNull(occurredAt, "occurredAt must not be null");
		Objects.requireNonNull(eventType, "eventType must not be null");
		if (!RESERVATION_AGGREGATE.equals(aggregateType)) {
			throw new IllegalArgumentException("aggregateType must be RESERVATION");
		}
		if (aggregateId == null || aggregateId < 1) {
			throw new IllegalArgumentException("aggregateId must be positive");
		}
		if (schemaVersion < 1) {
			throw new IllegalArgumentException("schemaVersion must be positive");
		}
	}

	public static ReservationEventMetadata create(
			ReservationEventType eventType,
			Long reservationId,
			Instant occurredAt
	) {
		return new ReservationEventMetadata(
				UUID.randomUUID(),
				occurredAt,
				RESERVATION_AGGREGATE,
				reservationId,
				eventType,
				CURRENT_SCHEMA_VERSION
		);
	}
}
