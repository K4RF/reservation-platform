package junsik.reservation.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

public record RepresentativeGuestRequest(
		@NotBlank(message = "대표 투숙객 이름은 필수입니다.")
		@Size(max = 100, message = "대표 투숙객 이름은 100자 이하여야 합니다.")
		@Schema(description = "실제 투숙을 대표하는 고객 이름", example = "홍길동")
		String name,

		@NotBlank(message = "대표 투숙객 이메일은 필수입니다.")
		@Email(message = "올바른 이메일 형식이어야 합니다.")
		@Size(max = 255, message = "대표 투숙객 이메일은 255자 이하여야 합니다.")
		@Schema(description = "예약 안내에 사용할 대표 투숙객 이메일", example = "guest@example.com")
		String email,

		@NotBlank(message = "대표 투숙객 연락처는 필수입니다.")
		@Size(max = 30, message = "대표 투숙객 연락처는 30자 이하여야 합니다.")
		@Pattern(regexp = "^[0-9+() .-]+$", message = "대표 투숙객 연락처 형식이 올바르지 않습니다.")
		@Schema(description = "대표 투숙객 연락처", example = "010-1234-5678")
		String phone
) {
}
