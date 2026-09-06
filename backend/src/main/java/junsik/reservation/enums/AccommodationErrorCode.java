package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum AccommodationErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "ACCOMMODATION_001", "존재하지 않는 숙소입니다."),
	INACTIVE(HttpStatus.CONFLICT, "ACCOMMODATION_002", "운영 중지된 숙소는 예약할 수 없습니다."),
	INVALID_SEARCH_PERIOD(
			HttpStatus.BAD_REQUEST,
			"ACCOMMODATION_003",
			"체크인과 체크아웃 날짜를 함께 입력하고 체크인 날짜를 더 이르게 설정해야 합니다."
	),
	INVALID_PRICE_RANGE(HttpStatus.BAD_REQUEST, "ACCOMMODATION_004", "최소 가격은 최대 가격 이하여야 합니다."),
	AVAILABILITY_REQUIRES_PERIOD(
			HttpStatus.BAD_REQUEST,
			"ACCOMMODATION_005",
			"예약 가능 여부를 검색하려면 체크인과 체크아웃 날짜가 필요합니다."
	);

	private final HttpStatus status;
	private final String code;
	private final String message;

	AccommodationErrorCode(HttpStatus status, String code, String message) {
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
