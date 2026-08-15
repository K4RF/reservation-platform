package junsik.reservation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateReservationRequest(
		@NotNull(message = "객실 ID는 필수입니다.")
		@Positive(message = "객실 ID는 양수여야 합니다.")
		Long roomId,

		@NotNull(message = "체크인 날짜는 필수입니다.")
		LocalDate checkInDate,

		@NotNull(message = "체크아웃 날짜는 필수입니다.")
		LocalDate checkOutDate
) {
}
