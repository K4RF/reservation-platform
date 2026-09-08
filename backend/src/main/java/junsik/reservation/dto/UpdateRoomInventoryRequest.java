package junsik.reservation.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.RoomInventorySaleStatus;

public record UpdateRoomInventoryRequest(
		@Min(value = 0, message = "전체 재고 수량은 0 이상이어야 합니다.")
		@Schema(description = "변경할 전체 판매 수량", example = "8", minimum = "0")
		@NotNull(message = "전체 재고 수량은 필수입니다.")
		Integer totalQuantity,

		@NotNull(message = "재고 판매 상태는 필수입니다.")
		@Schema(description = "날짜별 판매 상태", example = "OPEN")
		RoomInventorySaleStatus saleStatus
) {
}
