package junsik.reservation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import junsik.reservation.entity.Reservation;

public interface ReservationRepository
		extends JpaRepository<Reservation, Long>, JpaSpecificationExecutor<Reservation> {
}
