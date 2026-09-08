package junsik.reservation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.CancellationFeeRule;

public record CancellationFeeRuleResponse(
		@Schema(description = "수수료 구간 시작일", example = "3")
		int minDaysBeforeCheckIn,

		@Schema(description = "수수료율(%)", example = "30")
		int feeRatePercent
) {

	public static CancellationFeeRuleResponse from(CancellationFeeRule rule) {
		return new CancellationFeeRuleResponse(
				rule.getMinDaysBeforeCheckIn(),
				rule.getFeeRatePercent()
		);
	}
}
