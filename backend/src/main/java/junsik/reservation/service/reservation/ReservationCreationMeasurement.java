package junsik.reservation.service.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Opt-in timing for the isolated HTTP benchmark. Keeps identifiers and payloads out
 * of the measurement and leaves the default log level silent.
 */
final class ReservationCreationMeasurement {

	static final Logger LOGGER = LoggerFactory.getLogger("reservation.creation.measurement");

	private ReservationCreationMeasurement() {
	}
}
