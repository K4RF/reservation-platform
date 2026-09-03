package junsik.reservation.global.exception;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공통 API 오류 응답")
public record ErrorResponse(
		@Schema(description = "오류 발생 시각", example = "2030-01-10T09:30:00Z")
		Instant timestamp,

		@Schema(description = "HTTP 상태 코드", example = "400")
		int status,

		@Schema(description = "클라이언트가 식별할 수 있는 오류 코드", example = "COMMON_001")
		String code,

		@Schema(description = "오류 메시지", example = "입력값이 올바르지 않습니다.")
		String message,

		@Schema(description = "오류가 발생한 요청 경로", example = "/api/v1/reservations")
		String path,

		@Schema(description = "필드별 Validation 오류. 필드 오류가 아니면 빈 배열")
		List<ValidationError> errors
) {

	public ErrorResponse {
		errors = errors == null ? List.of() : errors.stream()
				.sorted(Comparator.comparing(ValidationError::field).thenComparing(ValidationError::message))
				.toList();
	}

	public static ErrorResponse of(ErrorCode errorCode, String path) {
		return new ErrorResponse(
				Instant.now(),
				errorCode.getStatus().value(),
				errorCode.getCode(),
				errorCode.getMessage(),
				path,
				List.of()
		);
	}

	public static ErrorResponse of(ErrorCode errorCode, String path, List<ValidationError> errors) {
		return new ErrorResponse(
				Instant.now(),
				errorCode.getStatus().value(),
				errorCode.getCode(),
				errorCode.getMessage(),
				path,
				errors
		);
	}

	@Schema(description = "필드 Validation 오류")
	public record ValidationError(
			@Schema(description = "오류 필드 또는 파라미터", example = "checkInDate")
			String field,

			@Schema(description = "Validation 메시지", example = "체크인 날짜는 필수입니다.")
			String message
	) {
		public ValidationError {
			field = field == null || field.isBlank() ? "request" : field;
			message = message == null || message.isBlank()
					? CommonErrorCode.INVALID_INPUT_VALUE.getMessage()
					: message;
		}
	}
}
