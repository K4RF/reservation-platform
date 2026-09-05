package junsik.reservation.controller;

import java.net.URI;
import java.time.LocalDate;

import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.CreateRoomDailyPriceRequest;
import junsik.reservation.dto.RoomDailyPriceResponse;
import junsik.reservation.dto.UpdateRoomDailyPriceRequest;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.service.RoomDailyPriceService;

@Tag(name = "Room Daily Prices", description = "날짜별 객실 가격 API")
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
				responseCode = "404",
				description = "객실 또는 날짜별 가격을 찾을 수 없음",
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
@RequestMapping("/api/v1/rooms/{roomId}/prices")
public class RoomDailyPriceController {

	private final RoomDailyPriceService roomDailyPriceService;

	public RoomDailyPriceController(RoomDailyPriceService roomDailyPriceService) {
		this.roomDailyPriceService = roomDailyPriceService;
	}

	@Operation(summary = "날짜별 객실 가격 등록")
	@ApiResponses({
			@ApiResponse(
					responseCode = "201",
					description = "날짜별 가격 등록 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = RoomDailyPriceResponse.class)
					)
			),
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "동일 객실·날짜 가격이 이미 존재함",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PostMapping
	public ResponseEntity<RoomDailyPriceResponse> create(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@Valid @RequestBody CreateRoomDailyPriceRequest request
	) {
		RoomDailyPriceResponse response = roomDailyPriceService.create(roomId, request);
		return ResponseEntity
				.created(URI.create("/api/v1/rooms/" + roomId + "/prices/" + response.stayDate()))
				.body(response);
	}

	@Operation(summary = "날짜별 객실 가격 수정")
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "날짜별 가격 수정 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = RoomDailyPriceResponse.class)
					)
			),
			@ApiResponse(
					responseCode = "403",
					description = "관리자 권한 필요",
					content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
			)
	})
	@PutMapping("/{stayDate}")
	public ResponseEntity<RoomDailyPriceResponse> update(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate stayDate,
			@Valid @RequestBody UpdateRoomDailyPriceRequest request
	) {
		return ResponseEntity.ok(roomDailyPriceService.update(roomId, stayDate, request));
	}

	@Operation(
			summary = "날짜별 객실 적용 가격 조회",
			description = "날짜별 가격이 없으면 객실 기본 1박 가격과 DEFAULT 출처를 반환합니다.",
			responses = @ApiResponse(
					responseCode = "200",
					description = "적용 가격 조회 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = RoomDailyPriceResponse.class)
					)
			)
	)
	@GetMapping("/{stayDate}")
	public ResponseEntity<RoomDailyPriceResponse> getEffectivePrice(
			@PathVariable @Positive(message = "객실 ID는 양수여야 합니다.") Long roomId,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate stayDate
	) {
		return ResponseEntity.ok(roomDailyPriceService.getEffectivePrice(roomId, stayDate));
	}
}
