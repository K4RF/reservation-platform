package junsik.reservation.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.CancellationPolicySnapshot;

public record CancellationPolicySnapshotResponse(
		@Schema(description = "무료 취소 기준일", example = "7")
		int freeCancellationDaysBeforeCheckIn,

		@Schema(description = "취소 마감 기준일", example = "1")
		int cancellationDeadlineDaysBeforeCheckIn,

		List<CancellationFeeRuleResponse> feeRules
) {

	public static CancellationPolicySnapshotResponse from(CancellationPolicySnapshot snapshot) {
		return new CancellationPolicySnapshotResponse(
				snapshot.freeCancellationDaysBeforeCheckIn(),
				snapshot.cancellationDeadlineDaysBeforeCheckIn(),
				snapshot.feeRules().stream().map(CancellationFeeRuleResponse::from).toList()
		);
	}
}
