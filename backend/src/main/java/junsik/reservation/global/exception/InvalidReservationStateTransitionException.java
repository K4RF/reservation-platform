package junsik.reservation.global.exception;

import java.util.Objects;

import junsik.reservation.enums.ReservationStatus;

public class InvalidReservationStateTransitionException extends RuntimeException {

	private final ReservationStatus currentStatus;
	private final Operation operation;

	public InvalidReservationStateTransitionException(
			ReservationStatus currentStatus,
			Operation operation
	) {
		super("Reservation status %s does not allow operation %s".formatted(
				currentStatus,
				operation
		));
		this.currentStatus = Objects.requireNonNull(currentStatus, "currentStatus must not be null");
		this.operation = Objects.requireNonNull(operation, "operation must not be null");
	}

	public ReservationStatus getCurrentStatus() {
		return currentStatus;
	}

	public Operation getOperation() {
		return operation;
	}

	public enum Operation {
		CANCEL,
		CHANGE_SCHEDULE
	}
}
