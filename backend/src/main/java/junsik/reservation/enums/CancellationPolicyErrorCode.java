package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum CancellationPolicyErrorCode implements ErrorCode {

	NOT_FOUND(HttpStatus.NOT_FOUND, "CANCELLATION_POLICY_001", "등록된 숙소 취소 정책이 없습니다."),
	ALREADY_EXISTS(HttpStatus.CONFLICT, "CANCELLATION_POLICY_002", "숙소 취소 정책이 이미 등록되어 있습니다."),
	INVALID_PERIOD_RANGE(
			HttpStatus.BAD_REQUEST,
			"CANCELLATION_POLICY_003",
			"무료 취소 기준은 취소 마감 기준보다 커야 합니다."
	),
	INVALID_FEE_RULES(
			HttpStatus.BAD_REQUEST,
			"CANCELLATION_POLICY_004",
			"부분 취소 수수료 구간은 중복 없이 취소 가능 기간 전체를 포함해야 합니다."
	),
	INVALID_FEE_RATE(
			HttpStatus.BAD_REQUEST,
			"CANCELLATION_POLICY_005",
			"부분 취소 수수료율은 1% 이상 100% 이하여야 합니다."
	);

	private final HttpStatus status;
	private final String code;
	private final String message;

	CancellationPolicyErrorCode(HttpStatus status, String code, String message) {
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
