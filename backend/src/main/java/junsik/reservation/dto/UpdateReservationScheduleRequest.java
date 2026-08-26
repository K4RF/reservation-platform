package junsik.reservation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;

public record UpdateReservationScheduleRequest(
		@NotNull(message = "체크인 날짜는 필수입니다.")
		LocalDate checkInDate,

		@NotNull(message = "체크아웃 날짜는 필수입니다.")
		LocalDate checkOutDate
) {
}
