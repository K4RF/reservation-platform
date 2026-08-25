package junsik.reservation.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import junsik.reservation.enums.RoomSortField;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.enums.SortDirection;

public record RoomSearchRequest(
		@Min(value = 1, message = "최소 수용 인원은 1명 이상이어야 합니다.")
		Integer minCapacity,

		@DecimalMin(value = "0.00", message = "최소 가격은 0 이상이어야 합니다.")
		BigDecimal minPrice,

		@DecimalMin(value = "0.00", message = "최대 가격은 0 이상이어야 합니다.")
		BigDecimal maxPrice,

		RoomStatus status,

		@Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
		Integer page,

		@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
		@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
		Integer size,

		RoomSortField sortBy,
		SortDirection direction
) {

	public RoomSearchRequest {
		page = page == null ? 0 : page;
		size = size == null ? 20 : size;
		sortBy = sortBy == null ? RoomSortField.ID : sortBy;
		direction = direction == null ? SortDirection.ASC : direction;
	}
}
