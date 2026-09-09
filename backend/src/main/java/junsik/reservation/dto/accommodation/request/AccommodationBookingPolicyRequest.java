package junsik.reservation.dto.accommodation.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

public record AccommodationBookingPolicyRequest(
		@NotNull(message = "최소 숙박일은 필수입니다.")
		@Min(value = 1, message = "최소 숙박일은 1일 이상이어야 합니다.")
		@Schema(description = "허용하는 최소 숙박일", example = "2", minimum = "1")
		Integer minStayNights,

		@NotNull(message = "최대 숙박일은 필수입니다.")
		@Min(value = 1, message = "최대 숙박일은 1일 이상이어야 합니다.")
		@Schema(description = "허용하는 최대 숙박일", example = "14", minimum = "1")
		Integer maxStayNights,

		@NotNull(message = "최소 사전 예약일은 필수입니다.")
		@Min(value = 0, message = "최소 사전 예약일은 0일 이상이어야 합니다.")
		@Schema(description = "체크인 전 필요한 최소 일수. 0이면 당일 예약 허용", example = "1", minimum = "0")
		Integer minAdvanceBookingDays,

		@NotNull(message = "최대 사전 예약일은 필수입니다.")
		@Min(value = 0, message = "최대 사전 예약일은 0일 이상이어야 합니다.")
		@Schema(description = "체크인 전 예약할 수 있는 최대 일수", example = "365", minimum = "0")
		Integer maxAdvanceBookingDays
) {
}
