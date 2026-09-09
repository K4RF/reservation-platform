package junsik.reservation.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Component;

@Component
public class ReservationDateProvider {

	private final Clock clock;

	public ReservationDateProvider(Clock clock) {
		this.clock = clock;
	}

	public LocalDate today(ZoneId zoneId) {
		return LocalDate.ofInstant(now(), zoneId);
	}

	public Instant now() {
		return clock.instant();
	}
}
