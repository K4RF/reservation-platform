package junsik.reservation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.ReservationNight;

public record ReservationNightResponse(
		@Schema(description = "예약이 점유하는 숙박일", example = "2030-01-10")
		LocalDate stayDate,

		@Schema(description = "예약 또는 일정 변경 시점의 해당 숙박일 가격", example = "150000.00")
		BigDecimal priceSnapshot
) {

	public static ReservationNightResponse from(ReservationNight night) {
		return new ReservationNightResponse(night.getStayDate(), night.getPriceSnapshot());
	}
}
