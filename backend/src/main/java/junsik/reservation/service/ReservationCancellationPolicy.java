package junsik.reservation.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Component;

import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.ReservationCancellationQuote;

@Component
public class ReservationCancellationPolicy {

	static final int MONEY_SCALE = 2;
	private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

	private final ReservationDateProvider dateProvider;

	public ReservationCancellationPolicy(ReservationDateProvider dateProvider) {
		this.dateProvider = dateProvider;
	}

	public ReservationCancellationQuote evaluate(Reservation reservation) {
		Instant cancelledAt = dateProvider.now();
		LocalDate cancellationDate = LocalDate.ofInstant(
				cancelledAt,
				reservation.getRoom().getAccommodation().getZoneId()
		);
		long daysBeforeCheckIn = ChronoUnit.DAYS.between(
				cancellationDate,
				reservation.getCheckInDate()
		);
		int feeRatePercent = reservation.getCancellationPolicySnapshot()
				.resolveFeeRatePercent(daysBeforeCheckIn);
		BigDecimal feeRate = BigDecimal.valueOf(feeRatePercent).divide(ONE_HUNDRED);
		BigDecimal cancellationFeeAmount = reservation.getTotalAmount()
				.multiply(feeRate)
				.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
		BigDecimal estimatedRefundAmount = reservation.getTotalAmount()
				.subtract(cancellationFeeAmount)
				.setScale(MONEY_SCALE, RoundingMode.HALF_UP);

		return new ReservationCancellationQuote(
				cancelledAt,
				cancellationDate,
				daysBeforeCheckIn,
				feeRatePercent,
				cancellationFeeAmount,
				estimatedRefundAmount
		);
	}
}
