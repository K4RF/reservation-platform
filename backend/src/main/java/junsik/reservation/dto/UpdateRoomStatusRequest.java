package junsik.reservation.dto;

import jakarta.validation.constraints.NotNull;

import junsik.reservation.enums.RoomStatus;

public record UpdateRoomStatusRequest(
		@NotNull(message = "객실 운영 상태는 필수입니다.")
		RoomStatus status
) {
}
