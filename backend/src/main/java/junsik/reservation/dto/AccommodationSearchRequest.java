package junsik.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import junsik.reservation.enums.AccommodationSortField;
import junsik.reservation.enums.SortDirection;

public record AccommodationSearchRequest(
		@Size(max = 100, message = "숙소명 검색어는 100자 이하여야 합니다.")
		String name,

		@Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
		Integer page,

		@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
		@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
		Integer size,

		AccommodationSortField sortBy,
		SortDirection direction
) {

	public AccommodationSearchRequest {
		page = page == null ? 0 : page;
		size = size == null ? 20 : size;
		sortBy = sortBy == null ? AccommodationSortField.ID : sortBy;
		direction = direction == null ? SortDirection.ASC : direction;
	}
}
