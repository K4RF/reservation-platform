package junsik.reservation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomDailyPrice;
import junsik.reservation.enums.RoomPriceSource;

public record RoomDailyPriceResponse(
		@Schema(description = "날짜별 가격 ID. 기본 가격 fallback이면 null", example = "1", nullable = true)
		Long roomDailyPriceId,

		@Schema(description = "객실 ID", example = "1")
		Long roomId,

		@Schema(description = "숙박 날짜", example = "2030-07-20")
		LocalDate stayDate,

		@Schema(description = "적용되는 1박 가격", example = "180000.00")
		BigDecimal nightlyPrice,

		@Schema(description = "DAILY는 날짜별 가격, DEFAULT는 객실 기본 가격", example = "DAILY")
		RoomPriceSource source
) {

	public static RoomDailyPriceResponse daily(RoomDailyPrice dailyPrice) {
		return new RoomDailyPriceResponse(
				dailyPrice.getId(),
				dailyPrice.getRoom().getId(),
				dailyPrice.getStayDate(),
				dailyPrice.getNightlyPrice(),
				RoomPriceSource.DAILY
		);
	}

	public static RoomDailyPriceResponse fallback(Room room, LocalDate stayDate) {
		return new RoomDailyPriceResponse(
				null,
				room.getId(),
				stayDate,
				room.getNightlyPrice(),
				RoomPriceSource.DEFAULT
		);
	}
}
