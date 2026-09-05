package junsik.reservation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.RoomDailyPrice;

public interface RoomDailyPriceRepository extends JpaRepository<RoomDailyPrice, Long> {

	Optional<RoomDailyPrice> findByRoomIdAndStayDate(Long roomId, LocalDate stayDate);

	boolean existsByRoomIdAndStayDate(Long roomId, LocalDate stayDate);

	List<RoomDailyPrice> findAllByRoomIdAndStayDateGreaterThanEqualAndStayDateLessThanOrderByStayDateAsc(
			Long roomId,
			LocalDate startDate,
			LocalDate endDate
	);
}
