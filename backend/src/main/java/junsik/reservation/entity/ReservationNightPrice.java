package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

public record ReservationNightPrice(
		LocalDate stayDate,
		BigDecimal priceSnapshot
) {

	public ReservationNightPrice {
		Objects.requireNonNull(stayDate, "stayDate must not be null");
		Objects.requireNonNull(priceSnapshot, "priceSnapshot must not be null");
		if (priceSnapshot.signum() < 0) {
			throw new IllegalArgumentException("priceSnapshot must not be negative");
		}
	}
}
