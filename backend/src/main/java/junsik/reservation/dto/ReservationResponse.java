package junsik.reservation.dto;

import java.time.LocalDate;

import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public record ReservationResponse(
		Long reservationId,
		Long memberId,
		Long roomId,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		ReservationStatus status
) {

	public static ReservationResponse from(Reservation reservation) {
		return new ReservationResponse(
				reservation.getId(),
				reservation.getMember().getId(),
				reservation.getRoom().getId(),
				reservation.getCheckInDate(),
				reservation.getCheckOutDate(),
				reservation.getStatus()
		);
	}
}
