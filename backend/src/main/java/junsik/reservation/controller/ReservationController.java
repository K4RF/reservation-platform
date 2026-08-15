package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.service.ReservationService;

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
}
