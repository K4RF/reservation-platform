package junsik.reservation.repository;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import junsik.reservation.entity.Room;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomStatus;

public interface RoomRepository extends JpaRepository<Room, Long>, JpaSpecificationExecutor<Room> {

	Page<Room> findAllByAccommodationId(Long accommodationId, Pageable pageable);

	@Query("""
			select room
			from Room room
			where room.accommodation.id = :accommodationId
			  and room.accommodation.status = :accommodationStatus
			  and room.status = :roomStatus
			  and room.capacity >= :guestCount
			  and :stayNights = (
			      select count(inventory.id)
			      from RoomInventory inventory
			      where inventory.room = room
			        and inventory.inventoryDate >= :checkInDate
			        and inventory.inventoryDate < :checkOutDate
			        and inventory.reservedQuantity < inventory.totalQuantity
			  )
			""")
	Page<Room> findAvailableRooms(
			@Param("accommodationId") Long accommodationId,
			@Param("accommodationStatus") AccommodationStatus accommodationStatus,
			@Param("roomStatus") RoomStatus roomStatus,
			@Param("checkInDate") LocalDate checkInDate,
			@Param("checkOutDate") LocalDate checkOutDate,
			@Param("guestCount") int guestCount,
			@Param("stayNights") long stayNights,
			Pageable pageable
	);
}
