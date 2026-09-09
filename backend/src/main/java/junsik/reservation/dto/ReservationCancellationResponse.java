package junsik.reservation.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.ReservationCancellationQuote;
import junsik.reservation.enums.ReservationStatus;

public record ReservationCancellationResponse(
		Long reservationId,
		ReservationStatus status,
		@Schema(description = "취소 처리 시각(UTC)", example = "2030-01-01T03:00:00Z")
		Instant cancelledAt,
		@Schema(description = "예약 숙소 TimeZone 기준 취소일", example = "2030-01-01")
		LocalDate cancellationDate,
		@Schema(description = "취소일부터 체크인까지 남은 달력 일수", example = "9")
		long daysBeforeCheckIn,
		BigDecimal totalAmount,
		@Schema(description = "적용 취소 수수료율(%)", example = "30")
		int cancellationFeeRate,
		BigDecimal cancellationFeeAmount,
		@Schema(description = "결제 연동 전 예상 환불액", example = "437500.00")
		BigDecimal estimatedRefundAmount
) {

	public static ReservationCancellationResponse from(
			Reservation reservation,
			ReservationCancellationQuote quote
	) {
		return new ReservationCancellationResponse(
				reservation.getId(),
				reservation.getStatus(),
				reservation.getCancelledAt(),
				quote.cancellationDate(),
				quote.daysBeforeCheckIn(),
				reservation.getTotalAmount(),
				quote.cancellationFeeRate(),
				reservation.getCancellationFeeAmount(),
				reservation.getRefundAmount()
		);
	}
}
