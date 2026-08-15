package junsik.reservation.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateRoomRequest(
		@NotBlank(message = "객실명은 필수입니다.")
		@Size(max = 100, message = "객실명은 100자 이하여야 합니다.")
		String name,

		@NotNull(message = "수용 인원은 필수입니다.")
		@Min(value = 1, message = "수용 인원은 1명 이상이어야 합니다.")
		Integer capacity
) {
}
