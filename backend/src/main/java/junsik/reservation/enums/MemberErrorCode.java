package junsik.reservation.enums;

import org.springframework.http.HttpStatus;

import junsik.reservation.global.exception.ErrorCode;

public enum MemberErrorCode implements ErrorCode {

	DUPLICATE_EMAIL(HttpStatus.CONFLICT, "MEMBER_001", "이미 가입된 이메일입니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	MemberErrorCode(HttpStatus status, String code, String message) {
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
