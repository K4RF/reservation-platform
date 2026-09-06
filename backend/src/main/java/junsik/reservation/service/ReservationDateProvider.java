package junsik.reservation.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Component;

@Component
public class ReservationDateProvider {

	public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final Clock clock;

	public ReservationDateProvider(Clock clock) {
		this.clock = clock;
	}

	public LocalDate today() {
		return LocalDate.now(clock.withZone(BUSINESS_ZONE));
	}
}
