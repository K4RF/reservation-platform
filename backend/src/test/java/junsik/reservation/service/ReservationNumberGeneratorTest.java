package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class ReservationNumberGeneratorTest {

	@Test
	void usesTheAccommodationBusinessDateInThePublicNumber() {
		ReservationDateProvider dateProvider = new ReservationDateProvider(Clock.fixed(
				Instant.parse("2030-07-01T03:30:00Z"),
				ZoneOffset.UTC
		));
		ReservationNumberGenerator generator = new ReservationNumberGenerator(dateProvider);

		assertThat(generator.generate(ZoneId.of("Asia/Tokyo")))
				.matches("RSV-20300701-[A-F0-9]{16}");
		assertThat(generator.generate(ZoneId.of("America/New_York")))
				.matches("RSV-20300630-[A-F0-9]{16}");
	}
}
