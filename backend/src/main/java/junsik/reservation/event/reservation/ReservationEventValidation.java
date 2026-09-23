package junsik.reservation.event.reservation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

final class ReservationEventValidation {

	private ReservationEventValidation() {
	}

	static void requireEventType(
			ReservationEventMetadata metadata,
			ReservationEventType expectedType
	) {
		Objects.requireNonNull(metadata, "metadata must not be null");
		if (metadata.eventType() != expectedType) {
			throw new IllegalArgumentException("eventType must be " + expectedType);
		}
	}

	static void requireReservationNumber(String reservationNumber) {
		if (reservationNumber == null || reservationNumber.isBlank()) {
			throw new IllegalArgumentException("reservationNumber must not be blank");
		}
	}

	static void requirePositiveId(Long id, String fieldName) {
		if (id == null || id < 1) {
			throw new IllegalArgumentException(fieldName + " must be positive");
		}
	}

	static void requirePeriod(LocalDate checkInDate, LocalDate checkOutDate) {
		Objects.requireNonNull(checkInDate, "checkInDate must not be null");
		Objects.requireNonNull(checkOutDate, "checkOutDate must not be null");
		if (!checkInDate.isBefore(checkOutDate)) {
			throw new IllegalArgumentException("checkInDate must be before checkOutDate");
		}
	}

	static void requireNonNegative(BigDecimal amount, String fieldName) {
		Objects.requireNonNull(amount, fieldName + " must not be null");
		if (amount.signum() < 0) {
			throw new IllegalArgumentException(fieldName + " must not be negative");
		}
	}
}
