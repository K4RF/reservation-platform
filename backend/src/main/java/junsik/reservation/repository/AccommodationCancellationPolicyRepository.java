package junsik.reservation.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.AccommodationCancellationPolicy;

public interface AccommodationCancellationPolicyRepository
		extends JpaRepository<AccommodationCancellationPolicy, Long> {

	Optional<AccommodationCancellationPolicy> findByAccommodationId(Long accommodationId);

	boolean existsByAccommodationId(Long accommodationId);
}
