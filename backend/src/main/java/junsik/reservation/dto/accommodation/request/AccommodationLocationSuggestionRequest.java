package junsik.reservation.dto.accommodation.request;

import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

public record AccommodationLocationSuggestionRequest(
		@Size(max = 100, message = "지역 자동완성 검색어는 100자 이하여야 합니다.")
		@Schema(description = "도시·지역 검색어. 공백 정리 후 2글자 미만이면 빈 배열을 반환합니다.", example = "서울")
		String q
) {
}
