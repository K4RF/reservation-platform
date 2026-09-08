package junsik.reservation.dto;

import java.util.Set;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.AccommodationAmenity;

public record CreateAccommodationRequest(
		@NotBlank(message = "숙소 이름은 필수입니다.")
		@Size(max = 100, message = "숙소 이름은 100자 이하여야 합니다.")
		String name,

		@NotBlank(message = "숙소 설명은 필수입니다.")
		@Size(max = 1000, message = "숙소 설명은 1000자 이하여야 합니다.")
		String description,

		@NotBlank(message = "국가는 필수입니다.")
		@Size(max = 100, message = "국가는 100자 이하여야 합니다.")
		String country,

		@NotBlank(message = "도시는 필수입니다.")
		@Size(max = 100, message = "도시는 100자 이하여야 합니다.")
		String city,

		@NotBlank(message = "지역은 필수입니다.")
		@Size(max = 100, message = "지역은 100자 이하여야 합니다.")
		String region,

		@NotBlank(message = "상세 주소는 필수입니다.")
		@Size(max = 255, message = "상세 주소는 255자 이하여야 합니다.")
		@Schema(description = "상세 주소. 기존 address 필드명을 호환 목적으로 유지합니다.")
		String address,

		@Schema(description = "숙소 공용 편의시설")
		Set<AccommodationAmenity> amenities
) {

	public CreateAccommodationRequest {
		amenities = amenities == null ? Set.of() : Set.copyOf(amenities);
	}
}
