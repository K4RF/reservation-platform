package junsik.reservation.dto.accommodation.response;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.AccommodationBookingPolicy;

public record AccommodationBookingPolicyResponse(
		@Schema(description = "예약 정책 ID", example = "1")
		Long bookingPolicyId,

		@Schema(description = "숙소 ID", example = "1")
		Long accommodationId,

		@Schema(description = "최소 숙박일", example = "2")
		int minStayNights,

		@Schema(description = "최대 숙박일", example = "14")
		int maxStayNights,

		@Schema(description = "최소 사전 예약일", example = "1")
		int minAdvanceBookingDays,

		@Schema(description = "최대 사전 예약일", example = "365")
		int maxAdvanceBookingDays
) {

	public static AccommodationBookingPolicyResponse from(AccommodationBookingPolicy policy) {
		return new AccommodationBookingPolicyResponse(
				policy.getId(),
				policy.getAccommodation().getId(),
				policy.getMinStayNights(),
				policy.getMaxStayNights(),
				policy.getMinAdvanceBookingDays(),
				policy.getMaxAdvanceBookingDays()
		);
	}
}
