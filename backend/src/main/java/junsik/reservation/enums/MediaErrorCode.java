package junsik.reservation.enums;

import org.springframework.http.HttpStatus;
import junsik.reservation.global.exception.ErrorCode;

public enum MediaErrorCode implements ErrorCode {
	NOT_FOUND(HttpStatus.NOT_FOUND, "MEDIA_001", "이미지를 찾을 수 없습니다."),
	STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "MEDIA_002", "이미지 저장소를 읽을 수 없습니다.");

	private final HttpStatus status;
	private final String code;
	private final String message;

	MediaErrorCode(HttpStatus status, String code, String message) {
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
