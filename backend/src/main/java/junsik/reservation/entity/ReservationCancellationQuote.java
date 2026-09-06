package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ReservationCancellationQuote(
		LocalDate cancellationDate,
		long daysBeforeCheckIn,
		int cancellationFeeRate,
		BigDecimal cancellationFeeAmount,
		BigDecimal estimatedRefundAmount
) {
}
