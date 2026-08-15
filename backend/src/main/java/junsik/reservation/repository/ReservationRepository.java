package junsik.reservation.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

	boolean existsByRoomIdAndStatusAndCheckInDateLessThanAndCheckOutDateGreaterThan(
			Long roomId,
			ReservationStatus status,
			LocalDate checkOutDate,
			LocalDate checkInDate
	);
}
