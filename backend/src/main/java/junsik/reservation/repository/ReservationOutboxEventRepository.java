package junsik.reservation.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.enums.ReservationOutboxStatus;

public interface ReservationOutboxEventRepository extends JpaRepository<ReservationOutboxEvent, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select event
			from ReservationOutboxEvent event
			where event.status = :status
			order by event.createdAt asc, event.id asc
			""")
	List<ReservationOutboxEvent> findBatchByStatusForUpdate(
			@Param("status") ReservationOutboxStatus status,
			Pageable pageable
	);
}
