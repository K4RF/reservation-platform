package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.AccommodationResponse;
import junsik.reservation.dto.AccommodationSearchRequest;
import junsik.reservation.dto.CreateAccommodationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.service.AccommodationService;

@Tag(name = "Accommodations", description = "숙소 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
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
	public ResponseEntity<AccommodationResponse> create(
			@Valid @RequestBody CreateAccommodationRequest request
	) {
		AccommodationResponse response = accommodationService.create(request);
		return ResponseEntity
				.created(URI.create("/api/v1/accommodations/" + response.accommodationId()))
				.body(response);
	}

	@Operation(summary = "숙소 단건 조회")
	@GetMapping("/{accommodationId}")
	public ResponseEntity<AccommodationResponse> getById(@PathVariable Long accommodationId) {
		return ResponseEntity.ok(accommodationService.getById(accommodationId));
	}

	@Operation(summary = "숙소 목록 조회")
	@GetMapping
	public ResponseEntity<PageResponse<AccommodationResponse>> getAll(
			@Valid @ModelAttribute @ParameterObject AccommodationSearchRequest request
	) {
		return ResponseEntity.ok(accommodationService.getAll(request));
	}
}
