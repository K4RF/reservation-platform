package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class ReservationPeriodTest {

	@Test
	void calculatesStayDatesWithoutCheckoutDate() {
		ReservationPeriod period = new ReservationPeriod(
				LocalDate.of(2030, 1, 10),
				LocalDate.of(2030, 1, 13)
		);

		assertThat(period.stayNights()).isEqualTo(3);
		assertThat(period.stayDates()).containsExactly(
				LocalDate.of(2030, 1, 10),
				LocalDate.of(2030, 1, 11),
				LocalDate.of(2030, 1, 12)
		);
	}

	@Test
	void calculatesNightsAcrossMonthBoundary() {
		ReservationPeriod period = new ReservationPeriod(
				LocalDate.of(2030, 1, 30),
				LocalDate.of(2030, 2, 2)
		);

		assertThat(period.stayNights()).isEqualTo(3);
		assertThat(period.stayDates()).hasSize(3);
	}

	@Test
	void rejectsSameOrReversedPeriod() {
		LocalDate date = LocalDate.of(2030, 1, 10);

		assertThatThrownBy(() -> new ReservationPeriod(date, date))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new ReservationPeriod(date, date.minusDays(1)))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
