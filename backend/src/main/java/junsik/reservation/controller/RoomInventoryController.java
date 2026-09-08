package junsik.reservation.controller;

import java.net.URI;
import java.time.LocalDate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
import junsik.reservation.dto.CreateRoomInventoryRequest;
import junsik.reservation.dto.RoomInventoryCalendarResponse;
import junsik.reservation.dto.RoomInventoryResponse;
import junsik.reservation.dto.UpdateRoomInventoryRequest;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.RoomInventoryService;

@Tag(name = "Room Inventories", description = "날짜별 객실 재고 Calendar 관리 API")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@ApiResponses({
		@ApiResponse(responseCode = "400", description = "입력값 또는 Calendar 기간 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "401", description = "인증 필요",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "403", description = "관리자 권한 필요",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "404", description = "객실 또는 날짜별 재고를 찾을 수 없음",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "409", description = "중복 재고 또는 재고 수량 충돌",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class))),
		@ApiResponse(responseCode = "500", description = "서버 내부 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
						schema = @Schema(implementation = ErrorResponse.class)))
})
@Validated
@RestController
@RequestMapping("/api/v1/rooms/{roomId}/inventories")
public class RoomInventoryController {

	private final RoomInventoryService roomInventoryService;

	public RoomInventoryController(RoomInventoryService roomInventoryService) {
		this.roomInventoryService = roomInventoryService;
	}

	@Operation(summary = "날짜별 객실 재고 등록", description = "신규 재고의 판매 상태는 OPEN입니다.")
	@ApiResponse(responseCode = "201", description = "재고 등록 성공",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
					schema = @Schema(implementation = RoomInventoryResponse.class)))
	@PostMapping
	public ResponseEntity<RoomInventoryResponse> create(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@Valid @RequestBody CreateRoomInventoryRequest request
	) {
		RoomInventoryResponse response = roomInventoryService.create(roomId, request);
		return ResponseEntity.created(URI.create(
				"/api/v1/rooms/" + roomId + "/inventories/" + response.inventoryDate()
		)).body(response);
	}

	@Operation(summary = "날짜별 객실 재고 수정", description = "전체 수량과 OPEN/CLOSED 판매 상태를 변경합니다.")
	@ApiResponse(responseCode = "200", description = "재고 수정 성공",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
					schema = @Schema(implementation = RoomInventoryResponse.class)))
	@PutMapping("/{inventoryDate}")
	public ResponseEntity<RoomInventoryResponse> update(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inventoryDate,
			@Valid @RequestBody UpdateRoomInventoryRequest request
	) {
		return ResponseEntity.ok(roomInventoryService.update(roomId, inventoryDate, request));
	}

	@Operation(
			summary = "객실 재고 Calendar 조회",
			description = "시작일과 종료일을 모두 포함하며, 생성된 재고만 날짜순으로 반환합니다."
	)
	@ApiResponse(responseCode = "200", description = "재고 Calendar 조회 성공",
			content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
					schema = @Schema(implementation = RoomInventoryCalendarResponse.class)))
	@GetMapping
	public ResponseEntity<RoomInventoryCalendarResponse> getCalendar(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@RequestParam @NotNull(message = "Calendar 시작일은 필수입니다.")
			@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
			@RequestParam @NotNull(message = "Calendar 종료일은 필수입니다.")
			@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
	) {
		return ResponseEntity.ok(roomInventoryService.getCalendar(roomId, startDate, endDate));
	}
}
