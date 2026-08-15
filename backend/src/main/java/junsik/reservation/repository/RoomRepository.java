package junsik.reservation.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.Room;

public interface RoomRepository extends JpaRepository<Room, Long> {

	Page<Room> findAllByAccommodationId(Long accommodationId, Pageable pageable);
}
