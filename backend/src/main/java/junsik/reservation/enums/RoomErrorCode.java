package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum RoomErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "ROOM_001", "존재하지 않는 객실입니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	RoomErrorCode(HttpStatus status, String code, String message) {
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
