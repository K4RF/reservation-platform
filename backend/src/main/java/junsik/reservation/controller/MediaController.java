package junsik.reservation.controller;

import jakarta.validation.constraints.Positive;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.media.MediaContentService;

@RestController
@Validated
@RequestMapping("/api/v1/media")
@Tag(name = "Media", description = "카탈로그 공개 이미지 읽기. 업로드/관리 쓰기는 후속 범위")
public class MediaController {

	private final MediaContentService service;

	public MediaController(MediaContentService service) { this.service = service; }

	@GetMapping("/{mediaId}/content")
	@Operation(summary = "공개 이미지 원본 조회", description = "익명 읽기. 삭제/파일 없음은 404. URL은 재사용하지 않으며 브라우저 캐시는 저장하지 않습니다.")
	@ApiResponse(responseCode = "200", description = "저장 이미지 bytes (파일 크기 확인)", content = {
			@Content(mediaType = "image/jpeg", schema = @Schema(type = "string", format = "binary")),
			@Content(mediaType = "image/png", schema = @Schema(type = "string", format = "binary")),
			@Content(mediaType = "image/webp", schema = @Schema(type = "string", format = "binary"))
	})
	@ApiResponse(responseCode = "404", description = "Media 또는 파일 없음", content = @Content(
			mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class)))
	@ApiResponse(responseCode = "400", description = "잘못된 ID", content = @Content(
			mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class)))
	@ApiResponse(responseCode = "503", description = "이미지 저장소 읽기 실패", content = @Content(
			mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class)))
	public ResponseEntity<byte[]> content(@PathVariable @Positive Long mediaId) {
		MediaContentService.Content content = service.read(mediaId);
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.contentType(MediaType.parseMediaType(content.contentType()))
				.contentLength(content.bytes().length).body(content.bytes());
	}
}
