package junsik.reservation.entity;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;

import junsik.reservation.enums.CancellationPolicyErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.global.exception.BusinessException;

public record CancellationPolicySnapshot(
		int freeCancellationDaysBeforeCheckIn,
		int cancellationDeadlineDaysBeforeCheckIn,
		List<CancellationFeeRule> feeRules
) {

	private static final int DEFAULT_FREE_DAYS = 7;
	private static final int DEFAULT_DEADLINE_DAYS = 1;

	public CancellationPolicySnapshot {
		if (cancellationDeadlineDaysBeforeCheckIn < 0
				|| freeCancellationDaysBeforeCheckIn <= cancellationDeadlineDaysBeforeCheckIn) {
			throw new BusinessException(CancellationPolicyErrorCode.INVALID_PERIOD_RANGE);
		}
		if (feeRules == null || feeRules.isEmpty()) {
			throw new BusinessException(CancellationPolicyErrorCode.INVALID_FEE_RULES);
		}

		List<CancellationFeeRule> sortedRules = feeRules.stream()
				.map(CancellationFeeRule::copy)
				.sorted(Comparator.comparingInt(CancellationFeeRule::getMinDaysBeforeCheckIn).reversed())
				.toList();
		boolean hasDuplicateThreshold = new HashSet<>(sortedRules.stream()
				.map(CancellationFeeRule::getMinDaysBeforeCheckIn)
				.toList()).size() != sortedRules.size();
		boolean hasOutOfRangeThreshold = sortedRules.stream().anyMatch(rule ->
				rule.getMinDaysBeforeCheckIn() < cancellationDeadlineDaysBeforeCheckIn
						|| rule.getMinDaysBeforeCheckIn() >= freeCancellationDaysBeforeCheckIn);
		int lowestThreshold = sortedRules.getLast().getMinDaysBeforeCheckIn();
		if (hasDuplicateThreshold
				|| hasOutOfRangeThreshold
				|| lowestThreshold != cancellationDeadlineDaysBeforeCheckIn) {
			throw new BusinessException(CancellationPolicyErrorCode.INVALID_FEE_RULES);
		}
		feeRules = List.copyOf(sortedRules);
	}

	public static CancellationPolicySnapshot defaultPolicy() {
		return new CancellationPolicySnapshot(
				DEFAULT_FREE_DAYS,
				DEFAULT_DEADLINE_DAYS,
				List.of(
						CancellationFeeRule.create(3, 30),
						CancellationFeeRule.create(1, 50)
				)
		);
	}

	public int resolveFeeRatePercent(long daysBeforeCheckIn) {
		if (daysBeforeCheckIn >= freeCancellationDaysBeforeCheckIn) {
			return 0;
		}
		if (daysBeforeCheckIn < cancellationDeadlineDaysBeforeCheckIn) {
			throw new BusinessException(ReservationErrorCode.CANCELLATION_NOT_ALLOWED);
		}
		return feeRules.stream()
				.filter(rule -> daysBeforeCheckIn >= rule.getMinDaysBeforeCheckIn())
				.findFirst()
				.map(CancellationFeeRule::getFeeRatePercent)
				.orElseThrow(() -> new BusinessException(CancellationPolicyErrorCode.INVALID_FEE_RULES));
	}
}
