package junsik.reservation.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Component;

import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.ReservationCancellationQuote;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Component
public class ReservationCancellationPolicy {

	static final int FREE_CANCELLATION_MIN_DAYS = 7;
	static final int THIRTY_PERCENT_FEE_MIN_DAYS = 3;
	static final int FIFTY_PERCENT_FEE_MIN_DAYS = 1;
	static final int MONEY_SCALE = 2;

	private static final BigDecimal NO_FEE_RATE = BigDecimal.ZERO;
	private static final BigDecimal THIRTY_PERCENT_FEE_RATE = new BigDecimal("0.30");
	private static final BigDecimal FIFTY_PERCENT_FEE_RATE = new BigDecimal("0.50");

	private final ReservationDateProvider dateProvider;

	public ReservationCancellationPolicy(ReservationDateProvider dateProvider) {
		this.dateProvider = dateProvider;
	}

	public ReservationCancellationQuote evaluate(Reservation reservation) {
		LocalDate cancellationDate = dateProvider.today();
		long daysBeforeCheckIn = ChronoUnit.DAYS.between(
				cancellationDate,
				reservation.getCheckInDate()
		);
		BigDecimal feeRate = resolveFeeRate(daysBeforeCheckIn);
		BigDecimal cancellationFeeAmount = reservation.getTotalAmount()
				.multiply(feeRate)
				.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
		BigDecimal estimatedRefundAmount = reservation.getTotalAmount()
				.subtract(cancellationFeeAmount)
				.setScale(MONEY_SCALE, RoundingMode.HALF_UP);

		return new ReservationCancellationQuote(
				cancellationDate,
				daysBeforeCheckIn,
				feeRate.movePointRight(2).intValueExact(),
				cancellationFeeAmount,
				estimatedRefundAmount
		);
	}

	private BigDecimal resolveFeeRate(long daysBeforeCheckIn) {
		if (daysBeforeCheckIn >= FREE_CANCELLATION_MIN_DAYS) {
			return NO_FEE_RATE;
		}
		if (daysBeforeCheckIn >= THIRTY_PERCENT_FEE_MIN_DAYS) {
			return THIRTY_PERCENT_FEE_RATE;
		}
		if (daysBeforeCheckIn >= FIFTY_PERCENT_FEE_MIN_DAYS) {
			return FIFTY_PERCENT_FEE_RATE;
		}
		throw new BusinessException(ReservationErrorCode.CANCELLATION_NOT_ALLOWED);
	}
}
