package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record ReservationPriceSnapshot(
		BigDecimal firstNightPrice,
		BigDecimal totalAmount,
		List<ReservationNightPrice> nights
) {

	public ReservationPriceSnapshot {
		requireNonNegative(firstNightPrice, "firstNightPrice");
		requireNonNegative(totalAmount, "totalAmount");
		Objects.requireNonNull(nights, "nights must not be null");
		nights = List.copyOf(nights);
		if (nights.isEmpty()) {
			throw new IllegalArgumentException("숙박일별 가격 Snapshot은 비어 있을 수 없습니다.");
		}
		if (firstNightPrice.compareTo(nights.getFirst().priceSnapshot()) != 0) {
			throw new IllegalArgumentException("첫 숙박일 가격은 첫 번째 숙박일 Snapshot과 일치해야 합니다.");
		}
		BigDecimal nightTotal = nights.stream()
				.map(ReservationNightPrice::priceSnapshot)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		if (totalAmount.compareTo(nightTotal) != 0) {
			throw new IllegalArgumentException("예약 총액은 숙박일별 가격 Snapshot 합계와 일치해야 합니다.");
		}
	}

	public static ReservationPriceSnapshot calculate(
			ReservationPeriod period,
			BigDecimal defaultNightlyPrice,
			Map<LocalDate, BigDecimal> dailyPrices
	) {
		Objects.requireNonNull(period, "period must not be null");
		requireNonNegative(defaultNightlyPrice, "defaultNightlyPrice");
		Objects.requireNonNull(dailyPrices, "dailyPrices must not be null");

		List<ReservationNightPrice> nights = period.stayDates().stream()
				.map(stayDate -> new ReservationNightPrice(
						stayDate,
						effectivePrice(stayDate, defaultNightlyPrice, dailyPrices)
				))
				.toList();
		BigDecimal totalAmount = nights.stream()
				.map(ReservationNightPrice::priceSnapshot)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		return new ReservationPriceSnapshot(
				nights.getFirst().priceSnapshot(),
				totalAmount,
				nights
		);
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
