package junsik.reservation.dto.reservation.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public record ReservationResponse(
		Long reservationId,
		@Schema(description = "고객 문의·결제·알림에 사용하는 외부 공개 예약번호", example = "RSV-20300101-A1B2C3D4E5F60708")
		String reservationNumber,
		Long memberId,
		Long roomId,
		@Schema(description = "성인과 아동을 합한 전체 예약 인원", example = "2", minimum = "1")
		int guestCount,
		RepresentativeGuestResponse representativeGuest,
		LocalDate checkInDate,
		LocalDate checkOutDate,
		@Schema(description = "예약 또는 일정 변경 시점의 첫 숙박일 적용 가격", example = "125000.00")
		BigDecimal nightlyPriceSnapshot,
		long stayNights,
		@Schema(description = "모든 숙박일 적용 가격을 합산한 확정 금액 Snapshot", example = "625000.00")
		BigDecimal totalAmount,
		@Schema(description = "날짜순 숙박일별 가격 Snapshot")
		List<ReservationNightResponse> nights,
		@Schema(description = "예약 생성 시점에 확정된 취소 정책")
		CancellationPolicySnapshotResponse cancellationPolicySnapshot,
		ReservationStatus status,
		@Schema(description = "취소 처리 시각(UTC). 확정 예약은 null", example = "2030-01-01T03:00:00Z")
		Instant cancelledAt,
		@Schema(description = "실제 적용된 취소 수수료 Snapshot. 확정 예약은 null", example = "75000.00")
		BigDecimal cancellationFeeAmount,
		@Schema(description = "예상 환불액 Snapshot. 확정 예약은 null", example = "175000.00")
		BigDecimal refundAmount
) {

	public static ReservationResponse from(Reservation reservation) {
		return new ReservationResponse(
				reservation.getId(),
				reservation.getReservationNumber(),
				reservation.getMember().getId(),
				reservation.getRoom().getId(),
				reservation.getGuestCount(),
				RepresentativeGuestResponse.from(reservation.getRepresentativeGuest()),
				reservation.getCheckInDate(),
				reservation.getCheckOutDate(),
				reservation.getNightlyPriceSnapshot(),
				reservation.getStayNights(),
				reservation.getTotalAmount(),
				reservation.getNights().stream().map(ReservationNightResponse::from).toList(),
				CancellationPolicySnapshotResponse.from(reservation.getCancellationPolicySnapshot()),
				reservation.getStatus(),
				reservation.getCancelledAt(),
				reservation.getCancellationFeeAmount(),
				reservation.getRefundAmount()
		);
	}
}
