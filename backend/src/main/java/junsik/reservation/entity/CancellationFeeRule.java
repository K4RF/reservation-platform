package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Embeddable;

import junsik.reservation.enums.CancellationPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Embeddable
public class CancellationFeeRule {

	@Column(
			name = "min_days_before_check_in",
			nullable = false,
			check = @CheckConstraint(constraint = "min_days_before_check_in >= 0")
	)
	private int minDaysBeforeCheckIn;

	@Column(
			name = "fee_rate_percent",
			nullable = false,
			check = @CheckConstraint(constraint = "fee_rate_percent between 1 and 100")
	)
	private int feeRatePercent;

	protected CancellationFeeRule() {
	}

	private CancellationFeeRule(int minDaysBeforeCheckIn, int feeRatePercent) {
		if (minDaysBeforeCheckIn < 0) {
			throw new BusinessException(CancellationPolicyErrorCode.INVALID_FEE_RULES);
		}
		if (feeRatePercent < 1 || feeRatePercent > 100) {
			throw new BusinessException(CancellationPolicyErrorCode.INVALID_FEE_RATE);
		}
		this.minDaysBeforeCheckIn = minDaysBeforeCheckIn;
		this.feeRatePercent = feeRatePercent;
	}

	public static CancellationFeeRule create(int minDaysBeforeCheckIn, int feeRatePercent) {
		return new CancellationFeeRule(minDaysBeforeCheckIn, feeRatePercent);
	}

	public CancellationFeeRule copy() {
		return create(minDaysBeforeCheckIn, feeRatePercent);
	}

	public int getMinDaysBeforeCheckIn() {
		return minDaysBeforeCheckIn;
	}

	public int getFeeRatePercent() {
		return feeRatePercent;
	}
}
