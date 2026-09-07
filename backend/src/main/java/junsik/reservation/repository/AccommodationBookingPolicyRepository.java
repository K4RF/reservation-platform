package junsik.reservation.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.AccommodationBookingPolicy;

public interface AccommodationBookingPolicyRepository
		extends JpaRepository<AccommodationBookingPolicy, Long> {

	Optional<AccommodationBookingPolicy> findByAccommodationId(Long accommodationId);

	boolean existsByAccommodationId(Long accommodationId);
}
