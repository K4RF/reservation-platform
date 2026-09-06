package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ReservationPriceSnapshotTest {

	private static final LocalDate CHECK_IN = LocalDate.of(2030, 1, 10);

	@Test
	void calculatesOneNightPriceWithDailyOverride() {
		ReservationPeriod period = new ReservationPeriod(CHECK_IN, CHECK_IN.plusDays(1));

		ReservationPriceSnapshot snapshot = ReservationPriceSnapshot.calculate(
				period,
				new BigDecimal("100000.00"),
				Map.of(CHECK_IN, new BigDecimal("150000.00"))
		);

		assertThat(snapshot.firstNightPrice()).isEqualByComparingTo("150000.00");
		assertThat(snapshot.totalAmount()).isEqualByComparingTo("150000.00");
	}

	@Test
	void sumsDailyPricesAndFallsBackToDefaultPrice() {
		ReservationPeriod period = new ReservationPeriod(CHECK_IN, CHECK_IN.plusDays(4));

		ReservationPriceSnapshot snapshot = ReservationPriceSnapshot.calculate(
				period,
				new BigDecimal("100000.00"),
				Map.of(
						CHECK_IN, new BigDecimal("120000.00"),
						CHECK_IN.plusDays(2), new BigDecimal("150000.00")
				)
		);

		assertThat(snapshot.firstNightPrice()).isEqualByComparingTo("120000.00");
		assertThat(snapshot.totalAmount()).isEqualByComparingTo("470000.00");
	}

	@Test
	void preservesTwoDecimalScaleWithoutRounding() {
		ReservationPeriod period = new ReservationPeriod(CHECK_IN, CHECK_IN.plusDays(2));

		ReservationPriceSnapshot snapshot = ReservationPriceSnapshot.calculate(
				period,
				new BigDecimal("100000.10"),
				Map.of(CHECK_IN.plusDays(1), new BigDecimal("120000.25"))
		);

		assertThat(snapshot.totalAmount()).isEqualByComparingTo("220000.35");
		assertThat(snapshot.totalAmount()).hasScaleOf(2);
	}
}
