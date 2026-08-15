package junsik.reservation.global.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

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

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(
			MethodArgumentNotValidException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = CommonErrorCode.INVALID_INPUT_VALUE;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI(), exception.getBindingResult()));
	}

	@ExceptionHandler(BindException.class)
	public ResponseEntity<ErrorResponse> handleBindException(
			BindException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = CommonErrorCode.INVALID_INPUT_VALUE;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI(), exception.getBindingResult()));
	}

	@ExceptionHandler(HandlerMethodValidationException.class)
	public ResponseEntity<ErrorResponse> handleHandlerMethodValidationException(
			HandlerMethodValidationException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = CommonErrorCode.INVALID_INPUT_VALUE;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
	}

	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ErrorResponse> handleConstraintViolationException(
			ConstraintViolationException exception,
			HttpServletRequest request
	) {
		ErrorCode errorCode = CommonErrorCode.INVALID_INPUT_VALUE;
		return ResponseEntity
				.status(errorCode.getStatus())
				.body(ErrorResponse.of(errorCode, request.getRequestURI()));
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
}
