package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum RoomDailyPriceErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "ROOM_PRICE_001", "해당 날짜의 객실 가격이 존재하지 않습니다."),
	DUPLICATE_DATE(HttpStatus.CONFLICT, "ROOM_PRICE_002", "해당 날짜의 객실 가격이 이미 존재합니다."),
	INVALID_PRICE(HttpStatus.BAD_REQUEST, "ROOM_PRICE_003", "날짜별 객실 가격은 0보다 커야 합니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	RoomDailyPriceErrorCode(HttpStatus status, String code, String message) {
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
