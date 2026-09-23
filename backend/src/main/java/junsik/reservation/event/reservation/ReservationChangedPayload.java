package junsik.reservation.event.reservation;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ReservationChangedPayload(
		String reservationNumber,
		Long memberId,
		Long roomId,
		LocalDate previousCheckInDate,
		LocalDate previousCheckOutDate,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		BigDecimal totalAmount
) {

	public ReservationChangedPayload {
		ReservationEventValidation.requireReservationNumber(reservationNumber);
		ReservationEventValidation.requirePositiveId(memberId, "memberId");
		ReservationEventValidation.requirePositiveId(roomId, "roomId");
		ReservationEventValidation.requirePeriod(previousCheckInDate, previousCheckOutDate);
		ReservationEventValidation.requirePeriod(checkInDate, checkOutDate);
		ReservationEventValidation.requireNonNegative(totalAmount, "totalAmount");
	}
}
