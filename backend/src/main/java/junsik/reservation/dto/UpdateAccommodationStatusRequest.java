package junsik.reservation.dto;

import jakarta.validation.constraints.NotNull;

import junsik.reservation.enums.AccommodationStatus;

public record UpdateAccommodationStatusRequest(
		@NotNull(message = "숙소 운영 상태는 필수입니다.")
		AccommodationStatus status
) {
}
