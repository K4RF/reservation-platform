package junsik.reservation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import io.swagger.v3.oas.annotations.media.Schema;

public record CreateReservationRequest(
		@NotNull(message = "객실 ID는 필수입니다.")
		@Positive(message = "객실 ID는 양수여야 합니다.")
		@Schema(description = "예약할 객실 ID", example = "1")
		Long roomId,

		@NotNull(message = "예약 인원은 필수입니다.")
		@Positive(message = "예약 인원은 1명 이상이어야 합니다.")
		@Schema(description = "성인과 아동을 합한 전체 예약 인원", example = "2", minimum = "1")
		Integer guestCount,

		@NotNull(message = "체크인 날짜는 필수입니다.")
		@Schema(description = "체크인 날짜", example = "2030-01-10")
		LocalDate checkInDate,

		@NotNull(message = "체크아웃 날짜는 필수입니다.")
		@Schema(description = "체크아웃 날짜", example = "2030-01-15")
		LocalDate checkOutDate
) {
}
