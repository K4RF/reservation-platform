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

import junsik.reservation.dto.CreateRoomRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.RoomResponse;
import junsik.reservation.service.RoomService;

@Validated
@RestController
@RequestMapping("/api/v1")
public class RoomController {

	private final RoomService roomService;

	public RoomController(RoomService roomService) {
		this.roomService = roomService;
	}

	@PostMapping("/accommodations/{accommodationId}/rooms")
	public ResponseEntity<RoomResponse> create(
			@PathVariable Long accommodationId,
			@Valid @RequestBody CreateRoomRequest request
	) {
		RoomResponse response = roomService.create(accommodationId, request);
		return ResponseEntity
				.created(URI.create("/api/v1/rooms/" + response.roomId()))
				.body(response);
	}

	@GetMapping("/rooms/{roomId}")
	public ResponseEntity<RoomResponse> getById(@PathVariable Long roomId) {
		return ResponseEntity.ok(roomService.getById(roomId));
	}

	@GetMapping("/accommodations/{accommodationId}/rooms")
	public ResponseEntity<PageResponse<RoomResponse>> getAllByAccommodation(
			@PathVariable Long accommodationId,
			@RequestParam(defaultValue = "0") @Min(value = 0, message = "페이지는 0 이상이어야 합니다.") int page,
			@RequestParam(defaultValue = "20")
			@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
			@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.") int size
	) {
		return ResponseEntity.ok(roomService.getAllByAccommodation(accommodationId, page, size));
	}
}
