package junsik.reservation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import junsik.reservation.entity.Accommodation;

public interface AccommodationRepository extends
		JpaRepository<Accommodation, Long>,
		JpaSpecificationExecutor<Accommodation> {
}
