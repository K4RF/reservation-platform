package junsik.reservation.repository;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import junsik.reservation.entity.Room;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.RoomStatus;

public interface RoomRepository extends JpaRepository<Room, Long> {

	Page<Room> findAllByAccommodationId(Long accommodationId, Pageable pageable);

	@Query("""
			select room
			from Room room
			where room.accommodation.id = :accommodationId
			  and room.status = :roomStatus
			  and room.capacity >= :guestCount
			  and not exists (
			      select reservation.id
			      from Reservation reservation
			      where reservation.room = room
			        and reservation.status = :reservationStatus
			        and reservation.checkInDate < :checkOutDate
			        and reservation.checkOutDate > :checkInDate
			  )
			""")
	Page<Room> findAvailableRooms(
			@Param("accommodationId") Long accommodationId,
			@Param("roomStatus") RoomStatus roomStatus,
			@Param("reservationStatus") ReservationStatus reservationStatus,
			@Param("checkInDate") LocalDate checkInDate,
			@Param("checkOutDate") LocalDate checkOutDate,
			@Param("guestCount") int guestCount,
			Pageable pageable
	);
}
