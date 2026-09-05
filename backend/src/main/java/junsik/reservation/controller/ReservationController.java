package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.dto.ReservationSearchRequest;
import junsik.reservation.dto.UpdateReservationScheduleRequest;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.service.ReservationService;

@Tag(name = "Reservations", description = "예약 API")
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
@RequestMapping("/api/v1/reservations")
public class ReservationController {

	private final ReservationService reservationService;

	public ReservationController(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

	@Operation(
			summary = "예약 생성",
			description = "예약 인원은 1명 이상이며 객실 최대 수용 인원을 초과할 수 없습니다.",
			responses = @ApiResponse(
					responseCode = "201",
					description = "예약 생성 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = ReservationResponse.class)
					)
			)
	)
	@PostMapping
	@ApiResponses({
			@ApiResponse(
					responseCode = "404",
					description = "회원 또는 객실을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "예약 기간 중복 또는 비활성 숙소·객실",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	public ResponseEntity<ReservationResponse> create(
			@AuthenticationPrincipal MemberPrincipal principal,
			@Valid @RequestBody CreateReservationRequest request
	) {
		ReservationResponse response = reservationService.create(principal.memberId(), request);
		return ResponseEntity
				.created(URI.create("/api/v1/reservations/" + response.reservationId()))
				.body(response);
	}

	@Operation(summary = "본인 예약 단건 조회")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "예약 소유자가 아님",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "예약을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@GetMapping("/{reservationId}")
	public ResponseEntity<ReservationResponse> getById(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable @Positive(message = "예약 ID는 양수여야 합니다.") Long reservationId
	) {
		return ResponseEntity.ok(reservationService.getById(principal.memberId(), reservationId));
	}

	@Operation(summary = "본인 예약 목록 조회")
	@GetMapping
	public ResponseEntity<PageResponse<ReservationResponse>> getAllByMember(
			@AuthenticationPrincipal MemberPrincipal principal,
			@Valid @ModelAttribute @ParameterObject ReservationSearchRequest request
	) {
		return ResponseEntity.ok(reservationService.getAllByMember(principal.memberId(), request));
	}

	@Operation(
			summary = "본인 예약 일정 변경",
			description = "예약 인원은 변경하지 않으며 현재 객실 최대 수용 인원을 다시 검증합니다."
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "예약 소유자가 아님",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "예약을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "예약 기간 중복 또는 변경할 수 없는 상태",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PatchMapping("/{reservationId}")
	public ResponseEntity<ReservationResponse> updateSchedule(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable @Positive(message = "예약 ID는 양수여야 합니다.") Long reservationId,
			@Valid @RequestBody UpdateReservationScheduleRequest request
	) {
		return ResponseEntity.ok(
				reservationService.updateSchedule(principal.memberId(), reservationId, request)
		);
	}

	@Operation(summary = "본인 예약 취소")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "예약 소유자가 아님",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "예약을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "이미 취소된 예약",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PatchMapping("/{reservationId}/cancel")
	public ResponseEntity<ReservationResponse> cancel(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable @Positive(message = "예약 ID는 양수여야 합니다.") Long reservationId
	) {
		return ResponseEntity.ok(reservationService.cancel(principal.memberId(), reservationId));
	}
}
