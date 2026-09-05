package junsik.reservation.support;

import java.time.LocalDate;

import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;

public final class RoomInventoryFixture {

	public static final LocalDate DEFAULT_DATE = LocalDate.of(2030, 1, 10);
	public static final int DEFAULT_TOTAL_QUANTITY = 3;

	private RoomInventoryFixture() {
	}

	public static RoomInventory roomInventory(Room room) {
		return roomInventory(room, DEFAULT_DATE, DEFAULT_TOTAL_QUANTITY);
	}

	public static RoomInventory roomInventory(Room room, LocalDate date, int totalQuantity) {
		return RoomInventory.create(room, date, totalQuantity);
	}
}
