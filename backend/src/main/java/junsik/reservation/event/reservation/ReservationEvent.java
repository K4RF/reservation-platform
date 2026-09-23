package junsik.reservation.event.reservation;

public sealed interface ReservationEvent permits
		ReservationCreatedEvent,
		ReservationChangedEvent,
		ReservationCancelledEvent {

	ReservationEventMetadata metadata();

	Object payload();

	default String partitionKey() {
		return metadata().aggregateId().toString();
	}
}
