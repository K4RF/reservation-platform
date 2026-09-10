package junsik.reservation.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import junsik.reservation.entity.RoomInventory;

public interface RoomInventoryRepository extends JpaRepository<RoomInventory, Long> {

	Optional<RoomInventory> findByRoomIdAndInventoryDate(Long roomId, LocalDate inventoryDate);

	boolean existsByRoomIdAndInventoryDate(Long roomId, LocalDate inventoryDate);

	List<RoomInventory> findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
			Long roomId,
			LocalDate startDate,
			LocalDate endDate
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select inventory
			from RoomInventory inventory
			where inventory.room.id = :roomId
			  and inventory.inventoryDate in :inventoryDates
			order by inventory.inventoryDate asc
			""")
	List<RoomInventory> findAllForUpdateByRoomIdAndInventoryDateIn(
			@Param("roomId") Long roomId,
			@Param("inventoryDates") Collection<LocalDate> inventoryDates
	);

	List<RoomInventory> findAllByRoomIdAndInventoryDateBetweenOrderByInventoryDateAsc(
			Long roomId,
			LocalDate startDate,
			LocalDate endDate
	);
}
