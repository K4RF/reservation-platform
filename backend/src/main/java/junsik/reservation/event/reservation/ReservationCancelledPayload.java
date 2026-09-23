package junsik.reservation.event.reservation;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

public record ReservationCancelledPayload(
		String reservationNumber,
		Long memberId,
		Long roomId,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		Instant cancelledAt,
		BigDecimal cancellationFeeAmount,
		BigDecimal refundAmount
) {

	public ReservationCancelledPayload {
		ReservationEventValidation.requireReservationNumber(reservationNumber);
		ReservationEventValidation.requirePositiveId(memberId, "memberId");
		ReservationEventValidation.requirePositiveId(roomId, "roomId");
		ReservationEventValidation.requirePeriod(checkInDate, checkOutDate);
		Objects.requireNonNull(cancelledAt, "cancelledAt must not be null");
		ReservationEventValidation.requireNonNegative(
				cancellationFeeAmount,
				"cancellationFeeAmount"
		);
		ReservationEventValidation.requireNonNegative(refundAmount, "refundAmount");
	}
}
