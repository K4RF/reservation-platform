package junsik.reservation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.RoomInventory;

public interface RoomInventoryRepository extends JpaRepository<RoomInventory, Long> {

	Optional<RoomInventory> findByRoomIdAndInventoryDate(Long roomId, LocalDate inventoryDate);

	boolean existsByRoomIdAndInventoryDate(Long roomId, LocalDate inventoryDate);

	List<RoomInventory> findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
			Long roomId,
			LocalDate startDate,
			LocalDate endDate
	);
}
