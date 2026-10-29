package junsik.reservation.enums;

import org.springframework.http.HttpStatus;
import junsik.reservation.global.exception.ErrorCode;

public enum MediaErrorCode implements ErrorCode {
	NOT_FOUND(HttpStatus.NOT_FOUND, "MEDIA_001", "이미지를 찾을 수 없습니다."),
	STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "MEDIA_002", "이미지 저장소를 사용할 수 없습니다."),
	INVALID_IMAGE(HttpStatus.BAD_REQUEST, "MEDIA_003", "유효한 JPEG/PNG 이미지와 허용된 파일 크기·픽셀 수가 필요합니다."),
	LIMIT_EXCEEDED(HttpStatus.CONFLICT, "MEDIA_004", "소유자당 이미지는 최대 20장입니다."),
	STALE_ALBUM(HttpStatus.CONFLICT, "MEDIA_005", "이미지 목록이 변경되었습니다. 관리 목록을 새로 조회하고 결과를 확인하세요."),
	INVALID_ORDER(HttpStatus.BAD_REQUEST, "MEDIA_006", "모든 현재 이미지 ID를 중복 없이 순서대로 전달해야 합니다."),
	INVALID_REVISION(HttpStatus.BAD_REQUEST, "MEDIA_007", "관리 목록 GET의 ETag를 If-Match에 전달해야 합니다."),
	UPLOAD_EXPIRED(HttpStatus.CONFLICT, "MEDIA_008", "업로드 준비가 만료되었습니다. 목록을 다시 확인하고 새로 제출하세요.");

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
