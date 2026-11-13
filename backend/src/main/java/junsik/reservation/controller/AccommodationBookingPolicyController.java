package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
import junsik.reservation.dto.accommodation.request.AccommodationBookingPolicyRequest;
import junsik.reservation.dto.accommodation.response.AccommodationBookingPolicyResponse;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.accommodation.AccommodationBookingPolicyService;

@Tag(name = "Accommodation Booking Policies", description = "숙소별 예약 정책 공개 조회 및 관리자 쓰기 API")
@ApiResponses({
		@ApiResponse(
				responseCode = "400",
				description = "입력값 또는 정책 범위 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "404",
				description = "숙소 또는 예약 정책을 찾을 수 없음",
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
@RequestMapping("/api/v1/accommodations/{accommodationId}/booking-policy")
public class AccommodationBookingPolicyController {

	private final AccommodationBookingPolicyService bookingPolicyService;

	public AccommodationBookingPolicyController(AccommodationBookingPolicyService bookingPolicyService) {
		this.bookingPolicyService = bookingPolicyService;
	}

	@GetMapping
	@Operation(summary = "숙소 예약 정책 조회",
			description = "현재 저장된 정책의 포함 경계를 반환합니다. 사전 예약일은 숙소 시간대의 달력 일수이며 가용성이나 예약 확정을 보장하지 않습니다.")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "저장된 예약 정책",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationBookingPolicyResponse.class))),
			@ApiResponse(responseCode = "204", description = "존재하는 숙소에 예약 정책 미설정", content = @Content),
			@ApiResponse(responseCode = "404", description = "숙소를 찾을 수 없음 (ACCOMMODATION_001)",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = ErrorResponse.class)))
	})
	public ResponseEntity<AccommodationBookingPolicyResponse> get(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId
	) {
		return bookingPolicyService.findByAccommodationId(accommodationId)
				.map(policy -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(policy))
				.orElseGet(() -> ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build());
	}

	@Operation(
			summary = "숙소 예약 정책 등록",
			responses = @ApiResponse(
					responseCode = "201",
					description = "숙소 예약 정책 등록 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationBookingPolicyResponse.class)
					)
			)
	)
	@PostMapping
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
	@ApiResponses({
			@ApiResponse(responseCode = "401", description = "인증 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode = "409", description = "숙소 예약 정책 중복",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class)))
	})
	public ResponseEntity<AccommodationBookingPolicyResponse> create(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody AccommodationBookingPolicyRequest request
	) {
		AccommodationBookingPolicyResponse response = bookingPolicyService.create(accommodationId, request);
		return ResponseEntity.created(URI.create(
				"/api/v1/accommodations/" + accommodationId + "/booking-policy"
		)).body(response);
	}

	@Operation(
			summary = "숙소 예약 정책 수정",
			responses = @ApiResponse(
					responseCode = "200",
					description = "숙소 예약 정책 수정 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = AccommodationBookingPolicyResponse.class)
					)
			)
	)
	@PutMapping
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
	@ApiResponses({
			@ApiResponse(responseCode = "401", description = "인증 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class)))
	})
	public ResponseEntity<AccommodationBookingPolicyResponse> update(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody AccommodationBookingPolicyRequest request
	) {
		return ResponseEntity.ok(bookingPolicyService.update(accommodationId, request));
	}
}
