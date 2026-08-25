package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.AvailableRoomRequest;
import junsik.reservation.dto.CreateRoomRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.RoomResponse;
import junsik.reservation.service.RoomService;

@Tag(name = "Rooms", description = "객실 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@Validated
@RestController
@RequestMapping("/api/v1")
public class RoomController {

	private final RoomService roomService;

	public RoomController(RoomService roomService) {
		this.roomService = roomService;
	}

	@Operation(
			summary = "숙소 객실 등록",
			responses = @ApiResponse(
					responseCode = "201",
					description = "객실 등록 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = RoomResponse.class)
					)
			)
	)
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

	@Operation(summary = "객실 단건 조회")
	@GetMapping("/rooms/{roomId}")
	public ResponseEntity<RoomResponse> getById(@PathVariable Long roomId) {
		return ResponseEntity.ok(roomService.getById(roomId));
	}

	@Operation(summary = "숙소별 객실 목록 조회")
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

	@Operation(
			summary = "예약 가능 객실 조회",
			description = "체크인·체크아웃 기간에 확정 예약과 겹치지 않고 요청 인원을 수용할 수 있는 운영 중 객실을 조회합니다."
	)
	@GetMapping("/accommodations/{accommodationId}/rooms/available")
	public ResponseEntity<PageResponse<RoomResponse>> getAvailableRooms(
			@PathVariable Long accommodationId,
			@Valid @ModelAttribute @ParameterObject AvailableRoomRequest request,
			@RequestParam(defaultValue = "0") @Min(value = 0, message = "페이지는 0 이상이어야 합니다.") int page,
			@RequestParam(defaultValue = "20")
			@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
			@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.") int size
	) {
		return ResponseEntity.ok(roomService.getAvailableRooms(accommodationId, request, page, size));
	}
}
