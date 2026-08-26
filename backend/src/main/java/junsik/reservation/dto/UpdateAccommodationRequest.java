package junsik.reservation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateAccommodationRequest(
		@NotBlank(message = "숙소 이름은 필수입니다.")
		@Size(max = 100, message = "숙소 이름은 100자 이하여야 합니다.")
		String name,

		@NotBlank(message = "숙소 설명은 필수입니다.")
		@Size(max = 1000, message = "숙소 설명은 1000자 이하여야 합니다.")
		String description,

		@NotBlank(message = "숙소 주소는 필수입니다.")
		@Size(max = 255, message = "숙소 주소는 255자 이하여야 합니다.")
		String address
) {
}
