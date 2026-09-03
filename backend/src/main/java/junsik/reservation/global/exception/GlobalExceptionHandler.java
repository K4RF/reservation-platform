package junsik.reservation.global.exception;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.global.exception.ErrorResponse.ValidationError;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<ErrorResponse> handleBusinessException(
			BusinessException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = exception.getErrorCode();
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
	}

	@ExceptionHandler(InvalidReservationStateTransitionException.class)
	public ResponseEntity<ErrorResponse> handleInvalidReservationStateTransitionException(
			InvalidReservationStateTransitionException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = switch (exception.getOperation()) {
			case CANCEL -> ReservationErrorCode.ALREADY_CANCELLED;
			case CHANGE_SCHEDULE -> ReservationErrorCode.SCHEDULE_CHANGE_NOT_ALLOWED;
		};
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
	}

	@ExceptionHandler(BindException.class)
	public ResponseEntity<ErrorResponse> handleBindException(
			BindException exception,
			HttpServletRequest request
	) {
		return errorResponse(
				CommonErrorCode.INVALID_INPUT_VALUE,
				request,
				exception.getBindingResult().getFieldErrors().stream()
						.map(error -> new ValidationError(error.getField(), error.getDefaultMessage()))
						.toList()
		);
	}

	@ExceptionHandler(HandlerMethodValidationException.class)
	public ResponseEntity<ErrorResponse> handleHandlerMethodValidationException(
			HandlerMethodValidationException exception,
			HttpServletRequest request
	) {
		List<ValidationError> errors = exception.getParameterValidationResults().stream()
				.flatMap(result -> validationErrors(result).stream())
				.toList();
		return errorResponse(CommonErrorCode.INVALID_INPUT_VALUE, request, errors);
	}

	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ErrorResponse> handleConstraintViolationException(
			ConstraintViolationException exception,
			HttpServletRequest request
	) {
		List<ValidationError> errors = exception.getConstraintViolations().stream()
				.map(violation -> new ValidationError(
						lastPathSegment(violation.getPropertyPath().toString()),
						violation.getMessage()
				))
				.toList();
		return errorResponse(CommonErrorCode.INVALID_INPUT_VALUE, request, errors);
	}

	@ExceptionHandler({
			HttpMessageNotReadableException.class,
			MethodArgumentTypeMismatchException.class,
			ServletRequestBindingException.class
	})
	public ResponseEntity<ErrorResponse> handleInvalidRequest(
			Exception exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = CommonErrorCode.INVALID_REQUEST;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleException(
			Exception exception,
			HttpServletRequest request
	) {
		log.error("Unhandled exception", exception);
		ErrorCode errorCode = CommonErrorCode.INTERNAL_SERVER_ERROR;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
	}

	private List<ValidationError> validationErrors(ParameterValidationResult result) {
		if (result instanceof ParameterErrors parameterErrors) {
			return parameterErrors.getFieldErrors().stream()
					.map(error -> new ValidationError(error.getField(), error.getDefaultMessage()))
					.toList();
		}

		String parameterName = result.getMethodParameter().getParameterName();
		String field = parameterName == null ? "parameter" : parameterName;
		return result.getResolvableErrors().stream()
				.map(error -> new ValidationError(field, defaultMessage(error)))
				.toList();
	}

	private String defaultMessage(MessageSourceResolvable error) {
		return error.getDefaultMessage() == null ? CommonErrorCode.INVALID_INPUT_VALUE.getMessage()
				: error.getDefaultMessage();
	}

	private String lastPathSegment(String propertyPath) {
		int separator = propertyPath.lastIndexOf('.');
		return separator < 0 ? propertyPath : propertyPath.substring(separator + 1);
	}

	private ResponseEntity<ErrorResponse> errorResponse(
			ErrorCode errorCode,
			HttpServletRequest request,
			List<ValidationError> errors
	) {
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI(), errors));
	}
}
