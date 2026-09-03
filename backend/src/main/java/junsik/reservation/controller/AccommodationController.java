package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
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
import junsik.reservation.dto.AccommodationResponse;
import junsik.reservation.dto.AccommodationSearchRequest;
import junsik.reservation.dto.CreateAccommodationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.UpdateAccommodationRequest;
import junsik.reservation.dto.UpdateAccommodationStatusRequest;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.AccommodationService;

@Tag(name = "Accommodations", description = "숙소 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@ApiResponses({
		@ApiResponse(
				responseCode = "400",
				description = "입력값 또는 요청 형식 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "401",
				description = "인증 필요",
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
@RequestMapping("/api/v1/accommodations")
public class AccommodationController {

	private final AccommodationService accommodationService;

	public AccommodationController(AccommodationService accommodationService) {
		this.accommodationService = accommodationService;
	}

	@Operation(
			summary = "숙소 등록",
			responses = @ApiResponse(
					responseCode = "201",
					description = "숙소 등록 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationResponse.class)
					)
			)
	)
	@PostMapping
	@ApiResponse(
			responseCode = "403",
			description = "관리자 권한 필요",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
	)
	public ResponseEntity<AccommodationResponse> create(
			@Valid @RequestBody CreateAccommodationRequest request
	) {
		AccommodationResponse response = accommodationService.create(request);
		return ResponseEntity
				.created(URI.create("/api/v1/accommodations/" + response.accommodationId()))
				.body(response);
	}

	@Operation(summary = "숙소 단건 조회")
	@ApiResponse(
			responseCode = "404",
			description = "숙소를 찾을 수 없음",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
	)
	@GetMapping("/{accommodationId}")
	public ResponseEntity<AccommodationResponse> getById(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId
	) {
		return ResponseEntity.ok(accommodationService.getById(accommodationId));
	}

	@Operation(summary = "숙소 목록 조회")
	@GetMapping
	public ResponseEntity<PageResponse<AccommodationResponse>> getAll(
			@Valid @ModelAttribute @ParameterObject AccommodationSearchRequest request
	) {
		return ResponseEntity.ok(accommodationService.getAll(request));
	}

	@Operation(summary = "숙소 정보 수정")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "숙소를 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PutMapping("/{accommodationId}")
	public ResponseEntity<AccommodationResponse> update(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody UpdateAccommodationRequest request
	) {
		return ResponseEntity.ok(accommodationService.update(accommodationId, request));
	}

	@Operation(summary = "숙소 운영 상태 변경")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "숙소를 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PatchMapping("/{accommodationId}/status")
	public ResponseEntity<AccommodationResponse> updateStatus(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody UpdateAccommodationStatusRequest request
	) {
		return ResponseEntity.ok(accommodationService.updateStatus(accommodationId, request));
	}
}
