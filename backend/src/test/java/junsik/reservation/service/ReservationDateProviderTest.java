package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class ReservationDateProviderTest {

	@Test
	void resolvesDifferentBusinessDatesFromTheSameUtcInstant() {
		ReservationDateProvider provider = providerAt("2030-07-01T03:30:00Z");

		assertThat(provider.today(ZoneId.of("Asia/Tokyo")))
				.isEqualTo(LocalDate.of(2030, 7, 1));
		assertThat(provider.today(ZoneId.of("America/New_York")))
				.isEqualTo(LocalDate.of(2030, 6, 30));
	}

	@Test
	void usesTheRegionalDstRulesProvidedByZoneId() {
		ReservationDateProvider provider = providerAt("2030-07-01T04:30:00Z");

		assertThat(provider.today(ZoneId.of("America/New_York")))
				.isEqualTo(LocalDate.of(2030, 7, 1));
	}

	private ReservationDateProvider providerAt(String instant) {
		return new ReservationDateProvider(Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
	}
}
