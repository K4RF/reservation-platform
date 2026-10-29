package junsik.reservation.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.media.MediaFileCleanupService;

@RestController
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class MediaCleanupController {
	private final MediaFileCleanupService service;
	public MediaCleanupController(MediaFileCleanupService service) { this.service = service; }

	@PostMapping("/api/v1/admin/media/cleanup")
	@Operation(summary = "ADMIN 만기 파일 정리 1회 실행", description = "acknowledged=true 필수. DB에 기록된 최대20개만 처리, 임의 경로/전체 디스크 스캔 없음. 자동 replay 금지")
	@ApiResponse(responseCode = "400", description = "명시적 확인 필요", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
	@ApiResponse(responseCode = "401", description = "인증 필요", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
	@ApiResponse(responseCode = "403", description = "ADMIN 필요", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
	@ApiResponse(responseCode = "500", description = "DB/서버 실패. 정리 기록 확인 후 명시적 재검토", content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
	public MediaFileCleanupService.CleanupResult clean(@Valid @RequestBody Confirmation request) { return service.processDue(); }

	public record Confirmation(@AssertTrue boolean acknowledged) { }
}
