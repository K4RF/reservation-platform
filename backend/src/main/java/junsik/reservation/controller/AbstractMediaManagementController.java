package junsik.reservation.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Encoding;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import junsik.reservation.dto.media.request.MediaMetadataRequest;
import junsik.reservation.dto.media.request.MediaOrderRequest;
import junsik.reservation.dto.media.response.MediaAlbumResponse;
import junsik.reservation.enums.MediaOwnerType;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.media.MediaManagementService;
import junsik.reservation.service.media.MediaUploadCoordinator;

@ApiResponses({
		@ApiResponse(responseCode = "400", description = "입력/이미지/If-Match 형식 오류", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "401", description = "인증 필요", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "403", description = "ADMIN 필요", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "404", description = "소유자/해당 소유자의 이미지 없음", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "409", description = "목록 변경/20장 제한/업로드 만료. GET 후 명시적으로 재검토", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "500", description = "서버/DB 오류. 결과가 불명확하므로 자동 재실행 금지", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "503", description = "파일 저장소 실패", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
})
public abstract class AbstractMediaManagementController {
	private final MediaOwnerType type;
	private final MediaManagementService service;
	private final MediaUploadCoordinator upload;

	protected AbstractMediaManagementController(MediaOwnerType type, MediaManagementService service, MediaUploadCoordinator upload) {
		this.type = type;
		this.service = service;
		this.upload = upload;
	}

	@GetMapping
	@Operation(summary = "ADMIN 이미지 관리 목록", description = "캐시를 우회한 전체 목록(최대20). 응답 ETag를 이후 쓰기의 If-Match에 사용. source/rightsRecord는 ADMIN에만 공개")
	public ResponseEntity<MediaAlbumResponse> get(@PathVariable @Positive Long ownerId) {
		return response(service.get(type, ownerId), 200);
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Operation(summary = "이미지 업로드", description = "file+JSON metadata(altText/source/rightsRecord). JPEG/PNG 실제 decode 및 재인코딩, 10MiB/8192px/16M픽셀/20장 제한. 쓰기 자동 replay 금지",
			requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
					mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, encoding = @Encoding(name = "metadata", contentType = MediaType.APPLICATION_JSON_VALUE))),
			responses = @ApiResponse(responseCode = "201", description = "업로드 성공, 새 관리 목록", content = @Content(
					mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = MediaAlbumResponse.class))))
	public ResponseEntity<MediaAlbumResponse> create(@PathVariable @Positive Long ownerId,
			@RequestHeader("If-Match") String expected, @RequestPart MultipartFile file,
			@Valid @RequestPart MediaMetadataRequest metadata) {
		return response(upload.upload(type, ownerId, expected, file, metadata, null), 201);
	}

	@PutMapping("/{mediaId}")
	@Operation(summary = "이미지 대체 텍스트/출처/사용권 수정")
	public ResponseEntity<MediaAlbumResponse> metadata(@PathVariable @Positive Long ownerId, @PathVariable @Positive Long mediaId,
			@RequestHeader("If-Match") String expected, @Valid @RequestBody MediaMetadataRequest request) {
		return response(service.updateMetadata(type, ownerId, mediaId, expected, request), 200);
	}

	@PatchMapping("/{mediaId}/representative")
	@Operation(summary = "대표 이미지 지정", description = "지정 이미지를 첫 순서로 이동. stale If-Match는409. 자동 재실행 없이 목록 재조회")
	public ResponseEntity<MediaAlbumResponse> representative(@PathVariable @Positive Long ownerId, @PathVariable @Positive Long mediaId,
			@RequestHeader("If-Match") String expected) {
		return response(service.representative(type, ownerId, mediaId, expected), 200);
	}

	@PutMapping("/order")
	@Operation(summary = "전체 이미지 순서 변경", description = "모든 현재 mediaIds를 한 번씩 전달. 첫 ID가 대표. 부분 목록/중복/외부 ID 거부")
	public ResponseEntity<MediaAlbumResponse> order(@PathVariable @Positive Long ownerId, @RequestHeader("If-Match") String expected,
			@Valid @RequestBody MediaOrderRequest request) {
		return response(service.reorder(type, ownerId, expected, request.mediaIds()), 200);
	}

	@PutMapping(value = "/{mediaId}/content", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Operation(summary = "이미지 파일 교체", description = "새 file/metadata로 새 Media ID와 URL 발급, 기존 위치 유지. 이전 URL은 commit 후404, 옛 파일은 정리 큐에서 재시도",
			requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
					mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, encoding = @Encoding(name = "metadata", contentType = MediaType.APPLICATION_JSON_VALUE))))
	public ResponseEntity<MediaAlbumResponse> replace(@PathVariable @Positive Long ownerId, @PathVariable @Positive Long mediaId,
			@RequestHeader("If-Match") String expected, @RequestPart MultipartFile file,
			@Valid @RequestPart MediaMetadataRequest metadata) {
		return response(upload.upload(type, ownerId, expected, file, metadata, mediaId), 200);
	}

	@DeleteMapping("/{mediaId}")
	@Operation(summary = "이미지 삭제", description = "DB 삭제 후 다음 이미지가 대표. 실제 파일은 commit 후 정리. 실패/응답 유실 시 GET 결과 검토; DELETE도 자동 replay 금지")
	public ResponseEntity<MediaAlbumResponse> delete(@PathVariable @Positive Long ownerId, @PathVariable @Positive Long mediaId,
			@RequestHeader("If-Match") String expected) {
		return response(service.delete(type, ownerId, mediaId, expected), 200);
	}

	private static ResponseEntity<MediaAlbumResponse> response(MediaAlbumResponse response, int status) {
		return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).eTag(response.revision()).body(response);
	}
}
