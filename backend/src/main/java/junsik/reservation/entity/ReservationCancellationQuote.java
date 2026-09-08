package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

public record ReservationCancellationQuote(
		Instant cancelledAt,
		LocalDate cancellationDate,
		long daysBeforeCheckIn,
		int cancellationFeeRate,
		BigDecimal cancellationFeeAmount,
		BigDecimal estimatedRefundAmount
) {

	public ReservationCancellationQuote {
		Objects.requireNonNull(cancelledAt, "cancelledAt must not be null");
		Objects.requireNonNull(cancellationDate, "cancellationDate must not be null");
		Objects.requireNonNull(cancellationFeeAmount, "cancellationFeeAmount must not be null");
		Objects.requireNonNull(estimatedRefundAmount, "estimatedRefundAmount must not be null");
		if (cancellationFeeRate < 0 || cancellationFeeRate > 100) {
			throw new IllegalArgumentException("cancellationFeeRate must be between 0 and 100");
		}
		if (cancellationFeeAmount.signum() < 0 || estimatedRefundAmount.signum() < 0) {
			throw new IllegalArgumentException("cancellation amounts must not be negative");
		}
	}
}
