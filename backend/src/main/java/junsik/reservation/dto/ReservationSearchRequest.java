package junsik.reservation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;

import junsik.reservation.enums.ReservationSortField;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.SortDirection;

public record ReservationSearchRequest(
		ReservationStatus status,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkInFrom,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkInTo,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkOutFrom,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkOutTo,

		@Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
		Integer page,

		@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
		@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
		Integer size,

		ReservationSortField sortBy,
		SortDirection direction
) {

	public ReservationSearchRequest {
		page = page == null ? 0 : page;
		size = size == null ? 20 : size;
		sortBy = sortBy == null ? ReservationSortField.ID : sortBy;
		direction = direction == null ? SortDirection.ASC : direction;
	}
}
