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
		@Schema(description = "예약 또는 일정 변경 시점의 첫 숙박일 적용 가격", example = "125000.00")
		BigDecimal nightlyPriceSnapshot,
		long stayNights,
		@Schema(description = "모든 숙박일 적용 가격을 합산한 확정 금액 Snapshot", example = "625000.00")
		BigDecimal totalAmount,
		@Schema(description = "예약 생성 시점에 확정된 취소 정책")
		CancellationPolicySnapshotResponse cancellationPolicySnapshot,
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
				CancellationPolicySnapshotResponse.from(reservation.getCancellationPolicySnapshot()),
				reservation.getStatus()
		);
	}
}
