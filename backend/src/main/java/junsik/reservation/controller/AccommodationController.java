package junsik.reservation.controller;

import java.net.URI;
import java.util.List;

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
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.accommodation.request.AccommodationLocationSuggestionRequest;
import junsik.reservation.dto.accommodation.request.AccommodationSearchRequest;
import junsik.reservation.dto.accommodation.request.CreateAccommodationRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationStatusRequest;
import junsik.reservation.dto.accommodation.response.AccommodationLocationSuggestionResponse;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.dto.common.response.PageResponse;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.accommodation.AccommodationLocationSuggestionService;
import junsik.reservation.service.accommodation.AccommodationService;

@Tag(name = "Accommodations", description = "숙소 API")
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
	private final AccommodationLocationSuggestionService locationSuggestionService;

	public AccommodationController(
			AccommodationService accommodationService,
			AccommodationLocationSuggestionService locationSuggestionService
	) {
		this.accommodationService = accommodationService;
		this.locationSuggestionService = locationSuggestionService;
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
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
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

	@Operation(
			summary = "숙소 통합 검색",
			description = "숙소명·정확 국가/도시/지역·자유 목적지(destination)·숙소/객실 편의시설·운영 상태와 예약 가능한 활성 객실의 기간·인원·기본 1박 가격을 조합해 검색합니다. 각 목적지 검색어와 복수 편의시설은 AND 조건입니다."
	)
	@GetMapping
	public ResponseEntity<PageResponse<AccommodationResponse>> getAll(
			@Valid @ModelAttribute @ParameterObject AccommodationSearchRequest request
	) {
		return ResponseEntity.ok(accommodationService.getAll(request));
	}

	@Operation(
			summary = "숙소 지역 자동완성 후보 조회",
			description = "활성 숙소의 구조화된 도시와 지역을 최대 10개 반환합니다. 날짜별 예약 가능 여부를 보장하지 않습니다. 선택한 후보의 searchParams를 숙소 통합 검색에 전달합니다."
	)
	@ApiResponse(
			responseCode = "200",
			description = "지역 후보 목록 (최대 10개)",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, array = @ArraySchema(
					schema = @Schema(implementation = AccommodationLocationSuggestionResponse.class), maxItems = 10))
	)
	@GetMapping("/locations/suggestions")
	public ResponseEntity<List<AccommodationLocationSuggestionResponse>> suggestLocations(
			@Valid @ModelAttribute @ParameterObject AccommodationLocationSuggestionRequest request
	) {
		return ResponseEntity.ok(locationSuggestionService.suggest(request.q()));
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
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
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
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
	public ResponseEntity<AccommodationResponse> updateStatus(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody UpdateAccommodationStatusRequest request
	) {
		return ResponseEntity.ok(accommodationService.updateStatus(accommodationId, request));
	}
}
