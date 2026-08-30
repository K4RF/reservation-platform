package junsik.reservation.enums;

public enum ReservationSortField {

	ID("id"),
	CHECK_IN_DATE("checkInDate"),
	CHECK_OUT_DATE("checkOutDate"),
	TOTAL_AMOUNT("totalAmount");

	private final String property;

	ReservationSortField(String property) {
		this.property = property;
	}

	public String getProperty() {
		return property;
	}
}
