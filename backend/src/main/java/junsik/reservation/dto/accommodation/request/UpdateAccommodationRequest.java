package junsik.reservation.dto.accommodation.request;

import java.time.LocalTime;
import java.util.Set;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.global.validation.ValidZoneId;

public record UpdateAccommodationRequest(
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
		Set<AccommodationAmenity> amenities,

		@NotNull(message = "체크인 시간은 필수입니다.")
		@Schema(description = "숙소 기본 체크인 시간", example = "15:00:00")
		LocalTime checkInTime,

		@NotNull(message = "체크아웃 시간은 필수입니다.")
		@Schema(description = "숙소 기본 체크아웃 시간", example = "11:00:00")
		LocalTime checkOutTime,

		@NotBlank(message = "숙소 TimeZone은 필수입니다.")
		@ValidZoneId
		@Schema(description = "숙소 현지 날짜·시간 계산에 사용하는 IANA ZoneId", example = "Asia/Seoul")
		String timeZone
) {

	public UpdateAccommodationRequest {
		amenities = amenities == null ? Set.of() : Set.copyOf(amenities);
	}

	@AssertTrue(message = "체크인 시간과 체크아웃 시간은 달라야 합니다.")
	public boolean isOperatingTimeValid() {
		return checkInTime == null || checkOutTime == null || !checkInTime.equals(checkOutTime);
	}
}
