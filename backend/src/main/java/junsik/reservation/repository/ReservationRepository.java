package junsik.reservation.repository;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

	Page<Reservation> findAllByMemberId(Long memberId, Pageable pageable);

	boolean existsByRoomIdAndStatusAndCheckInDateLessThanAndCheckOutDateGreaterThan(
			Long roomId,
			ReservationStatus status,
			LocalDate checkOutDate,
			LocalDate checkInDate
	);
}
