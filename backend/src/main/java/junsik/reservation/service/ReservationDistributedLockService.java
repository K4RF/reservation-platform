package junsik.reservation.service;

import org.springframework.stereotype.Service;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;

@Service
public class ReservationDistributedLockService {

	private final ReservationDistributedLockManager lockManager;
	private final ReservationCreator reservationCreator;

	public ReservationDistributedLockService(
			ReservationDistributedLockManager lockManager,
			ReservationCreator reservationCreator
	) {
		this.lockManager = lockManager;
		this.reservationCreator = reservationCreator;
	}

	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		return lockManager.executeWithLock(
				request.roomId(),
				() -> reservationCreator.create(memberId, request)
		);
	}
}
