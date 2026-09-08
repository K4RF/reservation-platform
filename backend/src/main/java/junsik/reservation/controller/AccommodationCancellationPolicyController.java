package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.AccommodationCancellationPolicyRequest;
import junsik.reservation.dto.AccommodationCancellationPolicyResponse;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.AccommodationCancellationPolicyService;

@Tag(name = "Accommodation Cancellation Policies", description = "숙소별 취소 정책 관리 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@ApiResponses({
		@ApiResponse(
				responseCode = "400",
				description = "입력값 또는 취소 정책 범위 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "401",
				description = "인증 필요",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "403",
				description = "관리자 권한 필요",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "404",
				description = "숙소 또는 취소 정책을 찾을 수 없음",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "409",
				description = "숙소 취소 정책 중복",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "500",
				description = "서버 내부 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		)
})
@Validated
@RestController
@RequestMapping("/api/v1/accommodations/{accommodationId}/cancellation-policy")
public class AccommodationCancellationPolicyController {

	private final AccommodationCancellationPolicyService cancellationPolicyService;

	public AccommodationCancellationPolicyController(
			AccommodationCancellationPolicyService cancellationPolicyService
	) {
		this.cancellationPolicyService = cancellationPolicyService;
	}

	@Operation(
			summary = "숙소 취소 정책 등록",
			responses = @ApiResponse(
					responseCode = "201",
					description = "숙소 취소 정책 등록 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationCancellationPolicyResponse.class)
					)
			)
	)
	@PostMapping
	public ResponseEntity<AccommodationCancellationPolicyResponse> create(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody AccommodationCancellationPolicyRequest request
	) {
		AccommodationCancellationPolicyResponse response = cancellationPolicyService.create(
				accommodationId,
				request
		);
		return ResponseEntity.created(URI.create(
				"/api/v1/accommodations/" + accommodationId + "/cancellation-policy"
		)).body(response);
	}

	@Operation(
			summary = "숙소 취소 정책 수정",
			responses = @ApiResponse(
					responseCode = "200",
					description = "숙소 취소 정책 수정 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationCancellationPolicyResponse.class)
					)
			)
	)
	@PutMapping
	public ResponseEntity<AccommodationCancellationPolicyResponse> update(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody AccommodationCancellationPolicyRequest request
	) {
		return ResponseEntity.ok(cancellationPolicyService.update(accommodationId, request));
	}
}
