package junsik.reservation.service;

import org.springframework.stereotype.Service;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;

@Service
public class ReservationCreationCoordinator {

	private final ReservationCreationLock creationLock;
	private final ReservationCreator reservationCreator;

	public ReservationCreationCoordinator(
			ReservationCreationLock creationLock,
			ReservationCreator reservationCreator
	) {
		this.creationLock = creationLock;
		this.reservationCreator = reservationCreator;
	}

	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		return creationLock.execute(
				request.roomId(),
				() -> reservationCreator.create(memberId, request)
		);
	}
}
