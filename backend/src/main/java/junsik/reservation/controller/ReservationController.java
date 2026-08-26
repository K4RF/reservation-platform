package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.dto.UpdateReservationScheduleRequest;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.service.ReservationService;

@Tag(name = "Reservations", description = "예약 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
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
	@GetMapping("/{reservationId}")
	public ResponseEntity<ReservationResponse> getById(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable Long reservationId
	) {
		return ResponseEntity.ok(reservationService.getById(principal.memberId(), reservationId));
	}

	@Operation(summary = "본인 예약 목록 조회")
	@GetMapping
	public ResponseEntity<PageResponse<ReservationResponse>> getAllByMember(
			@AuthenticationPrincipal MemberPrincipal principal,
			@RequestParam(defaultValue = "0") @Min(value = 0, message = "페이지는 0 이상이어야 합니다.") int page,
			@RequestParam(defaultValue = "20")
			@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
			@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.") int size
	) {
		return ResponseEntity.ok(reservationService.getAllByMember(principal.memberId(), page, size));
	}

	@Operation(summary = "본인 예약 일정 변경")
	@PatchMapping("/{reservationId}")
	public ResponseEntity<ReservationResponse> updateSchedule(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable Long reservationId,
			@Valid @RequestBody UpdateReservationScheduleRequest request
	) {
		return ResponseEntity.ok(
				reservationService.updateSchedule(principal.memberId(), reservationId, request)
		);
	}

	@Operation(summary = "본인 예약 취소")
	@PatchMapping("/{reservationId}/cancel")
	public ResponseEntity<ReservationResponse> cancel(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable Long reservationId
	) {
		return ResponseEntity.ok(reservationService.cancel(principal.memberId(), reservationId));
	}
}
