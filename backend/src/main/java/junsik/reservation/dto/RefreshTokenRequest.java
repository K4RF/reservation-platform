package junsik.reservation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RefreshTokenRequest(
		@NotBlank(message = "Refresh Token은 필수입니다.")
		@Size(max = 4096, message = "Refresh Token은 4096자 이하여야 합니다.")
		String refreshToken
) {
}
