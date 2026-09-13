package junsik.reservation.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;

@Service
public class ReservationRetryService {

	static final int MAX_ATTEMPTS = 3;

	private static final Logger log = LoggerFactory.getLogger(ReservationRetryService.class);

	private final ReservationService reservationService;

	public ReservationRetryService(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			try {
				return reservationService.create(memberId, request);
			} catch (ObjectOptimisticLockingFailureException exception) {
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
			}
		}
		throw new IllegalStateException("Reservation retry loop completed without a result");
	}
}
