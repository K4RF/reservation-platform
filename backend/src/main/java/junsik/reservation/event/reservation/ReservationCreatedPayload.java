package junsik.reservation.event.reservation;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ReservationCreatedPayload(
		String reservationNumber,
		Long memberId,
		Long roomId,
		int guestCount,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		BigDecimal totalAmount
) {

	public ReservationCreatedPayload {
		ReservationEventValidation.requireReservationNumber(reservationNumber);
		ReservationEventValidation.requirePositiveId(memberId, "memberId");
		ReservationEventValidation.requirePositiveId(roomId, "roomId");
		if (guestCount < 1) {
			throw new IllegalArgumentException("guestCount must be positive");
		}
		ReservationEventValidation.requirePeriod(checkInDate, checkOutDate);
		ReservationEventValidation.requireNonNegative(totalAmount, "totalAmount");
	}
}
