package junsik.reservation.support;

import junsik.reservation.entity.Accommodation;

public final class AccommodationFixture {

	public static final String DEFAULT_NAME = "Ocean View Hotel";
	public static final String DEFAULT_DESCRIPTION = "Accommodation description";
	public static final String DEFAULT_ADDRESS = "Accommodation address";

	private AccommodationFixture() {
	}

	public static Accommodation accommodation() {
		return accommodation(DEFAULT_NAME);
	}

	public static Accommodation accommodation(String name) {
		return accommodation(name, DEFAULT_DESCRIPTION, DEFAULT_ADDRESS);
	}

	public static Accommodation accommodation(int index) {
		return accommodation(
				"Accommodation " + index,
				"Description " + index,
				"Address " + index
		);
	}

	public static Accommodation accommodation(String name, String description, String address) {
		return Accommodation.create(name, description, address);
	}
}
