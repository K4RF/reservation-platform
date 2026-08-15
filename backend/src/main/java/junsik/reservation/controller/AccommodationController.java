package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import junsik.reservation.dto.AccommodationResponse;
import junsik.reservation.dto.CreateAccommodationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.service.AccommodationService;

@Validated
@RestController
@RequestMapping("/api/v1/accommodations")
public class AccommodationController {

	private final AccommodationService accommodationService;

	public AccommodationController(AccommodationService accommodationService) {
		this.accommodationService = accommodationService;
	}

	@PostMapping
	public ResponseEntity<AccommodationResponse> create(
			@Valid @RequestBody CreateAccommodationRequest request
	) {
		AccommodationResponse response = accommodationService.create(request);
		return ResponseEntity
				.created(URI.create("/api/v1/accommodations/" + response.accommodationId()))
				.body(response);
	}

	@GetMapping("/{accommodationId}")
	public ResponseEntity<AccommodationResponse> getById(@PathVariable Long accommodationId) {
		return ResponseEntity.ok(accommodationService.getById(accommodationId));
	}

	@GetMapping
	public ResponseEntity<PageResponse<AccommodationResponse>> getAll(
			@RequestParam(defaultValue = "0") @Min(value = 0, message = "페이지는 0 이상이어야 합니다.") int page,
			@RequestParam(defaultValue = "20")
			@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
			@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.") int size
	) {
		return ResponseEntity.ok(accommodationService.getAll(page, size));
	}
}
