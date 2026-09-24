package junsik.reservation.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.reservation.ProcessedReservationEvent;

public interface ProcessedReservationEventRepository
		extends JpaRepository<ProcessedReservationEvent, Long> {

	boolean existsByEventId(String eventId);

	default boolean existsByEventId(UUID eventId) {
		return existsByEventId(eventId.toString());
	}
}
