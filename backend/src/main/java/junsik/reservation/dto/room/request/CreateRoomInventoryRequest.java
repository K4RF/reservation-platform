package junsik.reservation.dto.room.request;

import java.time.LocalDate;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

public record CreateRoomInventoryRequest(
		@NotNull(message = "재고 날짜는 필수입니다.")
		@Schema(description = "재고를 생성할 날짜", example = "2030-07-20")
		LocalDate inventoryDate,

		@Min(value = 0, message = "전체 재고 수량은 0 이상이어야 합니다.")
		@Schema(description = "해당 날짜의 전체 판매 수량", example = "10", minimum = "0")
		@NotNull(message = "전체 재고 수량은 필수입니다.")
		Integer totalQuantity
) {
}
