package junsik.reservation.enums;

public enum RoomSortField {

	ID("id"),
	NAME("name"),
	CAPACITY("capacity"),
	NIGHTLY_PRICE("nightlyPrice");

	private final String property;

	RoomSortField(String property) {
		this.property = property;
	}

	public String getProperty() {
		return property;
	}
}
