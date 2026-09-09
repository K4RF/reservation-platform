package junsik.reservation.service;

import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.springframework.stereotype.Component;

@Component
public class ReservationNumberGenerator {

	private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

	private final ReservationDateProvider dateProvider;

	public ReservationNumberGenerator(ReservationDateProvider dateProvider) {
		this.dateProvider = dateProvider;
	}

	public String generate() {
		String randomPart = UUID.randomUUID().toString().replace("-", "")
				.substring(0, 16)
				.toUpperCase();
		return "RSV-" + dateProvider.today().format(DATE_FORMAT) + "-" + randomPart;
	}
}
