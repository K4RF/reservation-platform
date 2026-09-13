package junsik.reservation.service;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;

@FunctionalInterface
public interface ReservationCreator {

	ReservationResponse create(Long memberId, CreateReservationRequest request);
}
