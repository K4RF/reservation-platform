package junsik.reservation.enums;

public enum AccommodationSortField {

	ID("id"),
	NAME("name");

	private final String property;

	AccommodationSortField(String property) {
		this.property = property;
	}

	public String getProperty() {
		return property;
	}
}
