package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;

public record ReservationPriceSnapshot(
		BigDecimal firstNightPrice,
		BigDecimal totalAmount
) {

	public ReservationPriceSnapshot {
		requireNonNegative(firstNightPrice, "firstNightPrice");
		requireNonNegative(totalAmount, "totalAmount");
	}

	public static ReservationPriceSnapshot calculate(
			ReservationPeriod period,
			BigDecimal defaultNightlyPrice,
			Map<LocalDate, BigDecimal> dailyPrices
	) {
		Objects.requireNonNull(period, "period must not be null");
		requireNonNegative(defaultNightlyPrice, "defaultNightlyPrice");
		Objects.requireNonNull(dailyPrices, "dailyPrices must not be null");

		BigDecimal firstNightPrice = effectivePrice(
				period.checkInDate(),
				defaultNightlyPrice,
				dailyPrices
		);
		BigDecimal totalAmount = period.stayDates().stream()
				.map(stayDate -> effectivePrice(stayDate, defaultNightlyPrice, dailyPrices))
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		return new ReservationPriceSnapshot(firstNightPrice, totalAmount);
	}

	private static BigDecimal effectivePrice(
			LocalDate stayDate,
			BigDecimal defaultNightlyPrice,
			Map<LocalDate, BigDecimal> dailyPrices
	) {
		BigDecimal price = dailyPrices.getOrDefault(stayDate, defaultNightlyPrice);
		requireNonNegative(price, "nightlyPrice");
		return price;
	}

	private static void requireNonNegative(BigDecimal price, String fieldName) {
		Objects.requireNonNull(price, fieldName + " must not be null");
		if (price.signum() < 0) {
			throw new IllegalArgumentException(fieldName + " must not be negative");
		}
	}
}
