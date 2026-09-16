package junsik.reservation.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import junsik.reservation.entity.reservation.Reservation;
import junsik.reservation.enums.ReservationStatus;

public interface ReservationRepository
		extends JpaRepository<Reservation, Long>, JpaSpecificationExecutor<Reservation> {

	@Query("""
			select reservation
			from Reservation reservation
			where reservation.member.id = :memberId
			  and (:status is null or reservation.status = :status)
			  and (:checkInFrom is null or reservation.checkInDate >= :checkInFrom)
			  and (:checkInTo is null or reservation.checkInDate <= :checkInTo)
			  and (:checkOutFrom is null or reservation.checkOutDate >= :checkOutFrom)
			  and (:checkOutTo is null or reservation.checkOutDate <= :checkOutTo)
			  and (:cursor is null or reservation.id < :cursor)
			order by reservation.id desc
			""")
	List<Reservation> findAllByCursor(
			@Param("memberId") Long memberId,
			@Param("status") ReservationStatus status,
			@Param("checkInFrom") LocalDate checkInFrom,
			@Param("checkInTo") LocalDate checkInTo,
			@Param("checkOutFrom") LocalDate checkOutFrom,
			@Param("checkOutTo") LocalDate checkOutTo,
			@Param("cursor") Long cursor,
			Pageable pageable
	);
}
