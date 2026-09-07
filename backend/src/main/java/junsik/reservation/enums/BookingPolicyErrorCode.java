package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum BookingPolicyErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "BOOKING_POLICY_001", "등록된 숙소 예약 정책이 없습니다."),
	ALREADY_EXISTS(HttpStatus.CONFLICT, "BOOKING_POLICY_002", "숙소 예약 정책이 이미 등록되어 있습니다."),
	INVALID_STAY_RANGE(
			HttpStatus.BAD_REQUEST,
			"BOOKING_POLICY_003",
			"최소 숙박일은 1일 이상이고 최대 숙박일은 최소 숙박일 이상이어야 합니다."
	),
	INVALID_ADVANCE_RANGE(
			HttpStatus.BAD_REQUEST,
			"BOOKING_POLICY_004",
			"최소 사전 예약일은 0일 이상이고 최대 사전 예약일은 최소 사전 예약일 이상이어야 합니다."
	),
	STAY_TOO_SHORT(HttpStatus.CONFLICT, "BOOKING_POLICY_005", "숙소의 최소 숙박일을 충족하지 않습니다."),
	STAY_TOO_LONG(HttpStatus.CONFLICT, "BOOKING_POLICY_006", "숙소의 최대 숙박일을 초과했습니다."),
	ADVANCE_TOO_SHORT(HttpStatus.CONFLICT, "BOOKING_POLICY_007", "숙소의 최소 사전 예약일을 충족하지 않습니다."),
	ADVANCE_TOO_LONG(HttpStatus.CONFLICT, "BOOKING_POLICY_008", "숙소의 최대 사전 예약일을 초과했습니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	BookingPolicyErrorCode(HttpStatus status, String code, String message) {
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
