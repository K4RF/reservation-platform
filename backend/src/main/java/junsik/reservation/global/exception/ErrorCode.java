package junsik.reservation.global.exception;

import org.springframework.http.HttpStatus;

/**
 * Contract implemented by common and domain-specific error codes.
 */
public interface ErrorCode {

	HttpStatus getStatus();

	String getCode();

	String getMessage();
}
