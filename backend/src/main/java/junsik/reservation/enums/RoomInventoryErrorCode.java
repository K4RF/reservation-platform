package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum RoomInventoryErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "INVENTORY_001", "해당 날짜의 객실 재고가 존재하지 않습니다."),
	DUPLICATE_DATE(HttpStatus.CONFLICT, "INVENTORY_002", "해당 날짜의 객실 재고가 이미 존재합니다."),
	INVALID_TOTAL_QUANTITY(HttpStatus.BAD_REQUEST, "INVENTORY_003", "전체 재고 수량은 0 이상이어야 합니다."),
	INVALID_QUANTITY(HttpStatus.BAD_REQUEST, "INVENTORY_004", "변경할 재고 수량은 1 이상이어야 합니다."),
	INSUFFICIENT_QUANTITY(HttpStatus.CONFLICT, "INVENTORY_005", "예약 가능한 객실 재고가 부족합니다."),
	TOTAL_BELOW_RESERVED(HttpStatus.CONFLICT, "INVENTORY_006", "전체 재고는 예약된 수량보다 작게 변경할 수 없습니다."),
	RELEASE_EXCEEDS_RESERVED(HttpStatus.CONFLICT, "INVENTORY_007", "예약된 수량보다 많은 재고를 반환할 수 없습니다."),
	INACTIVE_ROOM(HttpStatus.CONFLICT, "INVENTORY_008", "운영 중지된 객실의 재고는 생성하거나 변경할 수 없습니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	RoomInventoryErrorCode(HttpStatus status, String code, String message) {
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
