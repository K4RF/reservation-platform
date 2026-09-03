package junsik.reservation.support;

import java.math.BigDecimal;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;

public final class RoomFixture {

	public static final String DEFAULT_NAME = "Deluxe Room";
	public static final int DEFAULT_CAPACITY = 2;
	public static final BigDecimal DEFAULT_NIGHTLY_PRICE = new BigDecimal("100000.00");

	private RoomFixture() {
	}

	public static Room room(Accommodation accommodation) {
		return room(accommodation, DEFAULT_NAME, DEFAULT_CAPACITY, DEFAULT_NIGHTLY_PRICE);
	}

	public static Room room(Accommodation accommodation, int index) {
		return Room.create(accommodation, "Room " + index, index + 1);
	}

	public static Room room(Accommodation accommodation, String name, int capacity) {
		return Room.create(accommodation, name, capacity);
	}

	public static Room room(
			Accommodation accommodation,
			String name,
			int capacity,
			String nightlyPrice
	) {
		return room(accommodation, name, capacity, new BigDecimal(nightlyPrice));
	}

	public static Room room(
			Accommodation accommodation,
			String name,
			int capacity,
			BigDecimal nightlyPrice
	) {
		return Room.create(accommodation, name, capacity, nightlyPrice);
	}
}
