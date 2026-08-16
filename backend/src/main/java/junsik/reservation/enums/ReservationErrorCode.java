package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum ReservationErrorCode implements ErrorCode {

	INVALID_PERIOD(HttpStatus.BAD_REQUEST, "RESERVATION_001", "체크인 날짜는 체크아웃 날짜보다 이전이어야 합니다."),
	PERIOD_OVERLAP(HttpStatus.CONFLICT, "RESERVATION_002", "해당 기간에 이미 예약된 객실입니다."),
	NOT_FOUND(HttpStatus.NOT_FOUND, "RESERVATION_003", "존재하지 않는 예약입니다."),
	ACCESS_DENIED(HttpStatus.FORBIDDEN, "RESERVATION_004", "본인의 예약만 조회하거나 취소할 수 있습니다."),
	ALREADY_CANCELLED(HttpStatus.CONFLICT, "RESERVATION_005", "이미 취소된 예약입니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	ReservationErrorCode(HttpStatus status, String code, String message) {
		this.status = status;
		this.code = code;
		this.message = message;
	}

	@Override
	public HttpStatus getStatus() {
		return status;
	}

	@Override
	public String getCode() {
		return code;
	}

	@Override
	public String getMessage() {
		return message;
	}
}
