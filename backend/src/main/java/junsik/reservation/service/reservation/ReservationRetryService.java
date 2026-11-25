package junsik.reservation.service.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;

@Service
public class ReservationRetryService implements ReservationCreator {

	static final int MAX_ATTEMPTS = 3;

	private static final Logger log = LoggerFactory.getLogger(ReservationRetryService.class);

	private final ReservationService reservationService;

	public ReservationRetryService(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

	@Override
	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		boolean measure = ReservationCreationMeasurement.LOGGER.isTraceEnabled();
		for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			long started = measure ? System.nanoTime() : 0L;
			String outcome = "error";
			try {
				ReservationResponse response = reservationService.create(memberId, request);
				outcome = "returned";
				return response;
			} catch (ObjectOptimisticLockingFailureException exception) {
				outcome = "conflict";
				if (attempt == MAX_ATTEMPTS) {
					throw exception;
				}
				log.warn(
						"Reservation inventory conflict. Retrying with a new transaction: attempt={}/{}, memberId={}, roomId={}",
						attempt + 1,
						MAX_ATTEMPTS,
						memberId,
						request.roomId()
				);
			} finally {
				if (measure) {
					ReservationCreationMeasurement.LOGGER.trace(
							"LOAD_CREATION_TX attempt={} elapsedNs={} result={}",
							attempt, System.nanoTime() - started, outcome
					);
				}
			}
		}
		throw new IllegalStateException("Reservation retry loop completed without a result");
	}
}
