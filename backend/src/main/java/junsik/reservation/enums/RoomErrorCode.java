package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum RoomErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "ROOM_001", "존재하지 않는 객실입니다."),
	INVALID_PERIOD(HttpStatus.BAD_REQUEST, "ROOM_002", "체크인 날짜는 체크아웃 날짜보다 이전이어야 합니다."),
	INVALID_PRICE_RANGE(HttpStatus.BAD_REQUEST, "ROOM_003", "최소 가격은 최대 가격 이하여야 합니다."),
	INACTIVE(HttpStatus.CONFLICT, "ROOM_004", "운영 중지된 객실은 예약할 수 없습니다.");

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
