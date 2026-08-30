package junsik.reservation.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public interface ReservationRepository
		extends JpaRepository<Reservation, Long>, JpaSpecificationExecutor<Reservation> {

	boolean existsByRoomIdAndStatusAndCheckInDateLessThanAndCheckOutDateGreaterThan(
			Long roomId,
			ReservationStatus status,
			LocalDate checkOutDate,
			LocalDate checkInDate
	);

	boolean existsByRoomIdAndStatusAndIdNotAndCheckInDateLessThanAndCheckOutDateGreaterThan(
			Long roomId,
			ReservationStatus status,
			Long excludedReservationId,
			LocalDate checkOutDate,
			LocalDate checkInDate
	);
}
