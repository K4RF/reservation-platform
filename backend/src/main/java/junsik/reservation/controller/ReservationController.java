package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

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

import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.service.ReservationService;

@Validated
@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {

	private final ReservationService reservationService;

	public ReservationController(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

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

	@GetMapping("/{reservationId}")
	public ResponseEntity<ReservationResponse> getById(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable Long reservationId
	) {
		return ResponseEntity.ok(reservationService.getById(principal.memberId(), reservationId));
	}

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

	@PatchMapping("/{reservationId}/cancel")
	public ResponseEntity<ReservationResponse> cancel(
			@AuthenticationPrincipal MemberPrincipal principal,
			@PathVariable Long reservationId
	) {
		return ResponseEntity.ok(reservationService.cancel(principal.memberId(), reservationId));
	}
}
