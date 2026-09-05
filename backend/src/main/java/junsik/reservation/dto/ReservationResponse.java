package junsik.reservation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public record ReservationResponse(
		Long reservationId,
		Long memberId,
		Long roomId,
		@Schema(description = "성인과 아동을 합한 전체 예약 인원", example = "2", minimum = "1")
		int guestCount,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		BigDecimal nightlyPriceSnapshot,
		long stayNights,
		BigDecimal totalAmount,
		ReservationStatus status
) {

	public static ReservationResponse from(Reservation reservation) {
		return new ReservationResponse(
				reservation.getId(),
				reservation.getMember().getId(),
				reservation.getRoom().getId(),
				reservation.getGuestCount(),
				reservation.getCheckInDate(),
				reservation.getCheckOutDate(),
				reservation.getNightlyPriceSnapshot(),
				reservation.getStayNights(),
				reservation.getTotalAmount(),
				reservation.getStatus()
		);
	}
}
