package junsik.reservation.event.reservation;

public sealed interface ReservationEvent permits
		ReservationCreatedEvent,
		ReservationChangedEvent,
		ReservationCancelledEvent {

	ReservationEventMetadata metadata();

	Object payload();

	/**
	 * Uses the Reservation Aggregate ID as the Kafka key so every lifecycle event
	 * for one Reservation is assigned to the same Topic partition.
	 */
	default String partitionKey() {
		return metadata().aggregateId().toString();
	}
}
