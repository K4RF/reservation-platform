package junsik.reservation.dto.accommodation.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.AccommodationLocationSuggestionType;
import junsik.reservation.enums.AccommodationStatus;

public record AccommodationLocationSuggestionResponse(
		AccommodationLocationSuggestionType type,
		@Schema(description = "도시 또는 지역의 표시 이름", example = "강남구")
		String displayName,
		@Schema(description = "숙소 통합 검색에 그대로 전달할 값. 지역 후보의 country와 city는 부모 위치입니다.")
		SearchParams searchParams
) {
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record SearchParams(
			@Schema(example = "대한민국") String country,
			@Schema(example = "서울특별시") String city,
			@Schema(description = "지역 후보에만 포함됩니다.", example = "강남구") String region,
			@Schema(allowableValues = "ACTIVE") AccommodationStatus status
	) {
	}
}
