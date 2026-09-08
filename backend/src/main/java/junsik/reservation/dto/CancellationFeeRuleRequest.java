package junsik.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

public record CancellationFeeRuleRequest(
		@NotNull(message = "수수료 구간 시작일은 필수입니다.")
		@Min(value = 0, message = "수수료 구간 시작일은 0일 이상이어야 합니다.")
		@Schema(description = "이 일수 이상 남았을 때 적용되는 구간", example = "3", minimum = "0")
		Integer minDaysBeforeCheckIn,

		@NotNull(message = "취소 수수료율은 필수입니다.")
		@Min(value = 1, message = "취소 수수료율은 1% 이상이어야 합니다.")
		@Max(value = 100, message = "취소 수수료율은 100% 이하여야 합니다.")
		@Schema(description = "적용 수수료율(%)", example = "30", minimum = "1", maximum = "100")
		Integer feeRatePercent
) {
}
