package junsik.reservation.dto.room.response;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record RoomInventoryCalendarResponse(
		@Schema(description = "객실 ID", example = "1")
		Long roomId,

		@Schema(description = "조회 시작일(포함)", example = "2030-07-01")
		LocalDate startDate,

		@Schema(description = "조회 종료일(포함)", example = "2030-07-31")
		LocalDate endDate,

		@Schema(description = "날짜순 재고 목록. 생성되지 않은 날짜는 포함하지 않습니다.")
		List<RoomInventoryResponse> inventories
) {
	public RoomInventoryCalendarResponse {
		inventories = List.copyOf(inventories);
	}
}
