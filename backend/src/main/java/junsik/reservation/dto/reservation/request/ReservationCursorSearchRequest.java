package junsik.reservation.dto.reservation.request;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;

import org.springframework.format.annotation.DateTimeFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.ReservationStatus;

public record ReservationCursorSearchRequest(
		ReservationStatus status,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkInFrom,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkInTo,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkOutFrom,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkOutTo,

		@Positive(message = "Cursor는 양수여야 합니다.")
		@Schema(description = "직전 응답의 nextCursor. 첫 조회에서는 생략", example = "100")
		Long cursor,

		@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
		@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
		Integer size
) {

	public ReservationCursorSearchRequest {
		size = size == null ? 20 : size;
	}
}
