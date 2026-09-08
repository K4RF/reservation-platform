package junsik.reservation.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.AccommodationCancellationPolicy;

public record AccommodationCancellationPolicyResponse(
		@Schema(description = "취소 정책 ID", example = "1")
		Long cancellationPolicyId,

		@Schema(description = "숙소 ID", example = "1")
		Long accommodationId,

		@Schema(description = "무료 취소 기준일", example = "7")
		int freeCancellationDaysBeforeCheckIn,

		@Schema(description = "취소 마감 기준일", example = "1")
		int cancellationDeadlineDaysBeforeCheckIn,

		List<CancellationFeeRuleResponse> feeRules
) {

	public static AccommodationCancellationPolicyResponse from(
			AccommodationCancellationPolicy policy
	) {
		return new AccommodationCancellationPolicyResponse(
				policy.getId(),
				policy.getAccommodation().getId(),
				policy.getFreeCancellationDaysBeforeCheckIn(),
				policy.getCancellationDeadlineDaysBeforeCheckIn(),
				policy.getFeeRules().stream().map(CancellationFeeRuleResponse::from).toList()
		);
	}
}
