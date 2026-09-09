package junsik.reservation.dto.accommodation.request;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

public record AccommodationCancellationPolicyRequest(
		@NotNull(message = "무료 취소 기준일은 필수입니다.")
		@Min(value = 1, message = "무료 취소 기준일은 1일 이상이어야 합니다.")
		@Schema(description = "이 일수 이상 남으면 무료 취소", example = "7", minimum = "1")
		Integer freeCancellationDaysBeforeCheckIn,

		@NotNull(message = "취소 마감 기준일은 필수입니다.")
		@Min(value = 0, message = "취소 마감 기준일은 0일 이상이어야 합니다.")
		@Schema(description = "이 일수 미만이면 취소 불가", example = "1", minimum = "0")
		Integer cancellationDeadlineDaysBeforeCheckIn,

		@NotEmpty(message = "부분 취소 수수료 구간은 하나 이상이어야 합니다.")
		@Schema(description = "무료 취소와 취소 불가 사이에 적용할 수수료 구간")
		List<@NotNull(message = "부분 취소 수수료 구간은 null일 수 없습니다.") @Valid CancellationFeeRuleRequest> feeRules
) {
}
