package junsik.reservation.global.exception;

import java.time.Instant;
import java.util.List;

import org.springframework.validation.BindingResult;

public record ErrorResponse(
		Instant timestamp,
		int status,
		String code,
		String message,
		String path,
		List<ValidationError> errors
) {

	public ErrorResponse {
		errors = List.copyOf(errors);
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

	public static ErrorResponse of(ErrorCode errorCode, String path, BindingResult bindingResult) {
		List<ValidationError> errors = bindingResult.getFieldErrors().stream()
				.map(error -> new ValidationError(error.getField(), error.getDefaultMessage()))
				.toList();

		return new ErrorResponse(
				Instant.now(),
				errorCode.getStatus().value(),
				errorCode.getCode(),
				errorCode.getMessage(),
				path,
				errors
		);
	}

	public record ValidationError(String field, String message) {
	}
}
