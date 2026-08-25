package junsik.reservation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.format.annotation.DateTimeFormat;

public record AvailableRoomRequest(
		@NotNull(message = "체크인 날짜는 필수입니다.")
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkInDate,

		@NotNull(message = "체크아웃 날짜는 필수입니다.")
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		LocalDate checkOutDate,

		@NotNull(message = "요청 인원은 필수입니다.")
		@Min(value = 1, message = "요청 인원은 1명 이상이어야 합니다.")
		Integer guestCount
) {
}
