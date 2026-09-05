package junsik.reservation.support;

import java.math.BigDecimal;
import java.time.LocalDate;

import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomDailyPrice;

public final class RoomDailyPriceFixture {

	public static final LocalDate DEFAULT_STAY_DATE = LocalDate.of(2030, 7, 20);
	public static final BigDecimal DEFAULT_NIGHTLY_PRICE = new BigDecimal("180000.00");

	private RoomDailyPriceFixture() {
	}

	public static RoomDailyPrice roomDailyPrice(Room room) {
		return roomDailyPrice(room, DEFAULT_STAY_DATE, DEFAULT_NIGHTLY_PRICE);
	}

	public static RoomDailyPrice roomDailyPrice(
			Room room,
			LocalDate stayDate,
			BigDecimal nightlyPrice
	) {
		return RoomDailyPrice.create(room, stayDate, nightlyPrice);
	}
}
