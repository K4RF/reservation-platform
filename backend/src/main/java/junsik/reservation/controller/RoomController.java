package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.AvailableRoomRequest;
import junsik.reservation.dto.CreateRoomRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.RoomResponse;
import junsik.reservation.dto.RoomSearchRequest;
import junsik.reservation.dto.UpdateRoomRequest;
import junsik.reservation.dto.UpdateRoomStatusRequest;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.RoomService;

@Tag(name = "Rooms", description = "객실 API")
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
	public ResponseEntity<RoomResponse> create(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @RequestBody CreateRoomRequest request
	) {
		RoomResponse response = roomService.create(accommodationId, request);
		return ResponseEntity
				.created(URI.create("/api/v1/rooms/" + response.roomId()))
				.body(response);
	}

	@Operation(summary = "객실 단건 조회")
	@ApiResponse(
			responseCode = "404",
			description = "객실을 찾을 수 없음",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
	)
	@GetMapping("/rooms/{roomId}")
	public ResponseEntity<RoomResponse> getById(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId
	) {
		return ResponseEntity.ok(roomService.getById(roomId));
	}

	@Operation(summary = "숙소별 객실 목록 조회")
	@ApiResponse(
			responseCode = "404",
			description = "숙소를 찾을 수 없음",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
	)
	@GetMapping("/accommodations/{accommodationId}/rooms")
	public ResponseEntity<PageResponse<RoomResponse>> getAllByAccommodation(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @ModelAttribute @ParameterObject RoomSearchRequest request
	) {
		return ResponseEntity.ok(roomService.getAllByAccommodation(accommodationId, request));
	}

	@Operation(
			summary = "예약 가능 객실 조회",
			description = "모든 숙박 날짜에 남은 재고가 있고 요청 인원을 수용할 수 있는 운영 중 객실을 조회합니다."
	)
	@ApiResponse(
			responseCode = "404",
			description = "숙소를 찾을 수 없음",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
	)
	@GetMapping("/accommodations/{accommodationId}/rooms/available")
	public ResponseEntity<PageResponse<RoomResponse>> getAvailableRooms(
			@PathVariable @Positive(message = "숙소 ID는 양수여야 합니다.") Long accommodationId,
			@Valid @ModelAttribute @ParameterObject AvailableRoomRequest request,
			@RequestParam(defaultValue = "0") @Min(value = 0, message = "페이지는 0 이상이어야 합니다.") int page,
			@RequestParam(defaultValue = "20")
			@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
			@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.") int size
	) {
		return ResponseEntity.ok(roomService.getAvailableRooms(accommodationId, request, page, size));
	}

	@Operation(summary = "객실 정보 수정")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "객실을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PutMapping("/rooms/{roomId}")
	public ResponseEntity<RoomResponse> update(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@Valid @RequestBody UpdateRoomRequest request
	) {
		return ResponseEntity.ok(roomService.update(roomId, request));
	}

	@Operation(summary = "객실 운영 상태 변경")
	@ApiResponses({
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "객실을 찾을 수 없음",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PatchMapping("/rooms/{roomId}/status")
	public ResponseEntity<RoomResponse> updateStatus(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@Valid @RequestBody UpdateRoomStatusRequest request
	) {
		return ResponseEntity.ok(roomService.updateStatus(roomId, request));
	}
}
