package junsik.reservation.repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import junsik.reservation.entity.accommodation.Accommodation;

public interface AccommodationRepository extends
		JpaRepository<Accommodation, Long>,
		JpaSpecificationExecutor<Accommodation> {

	@Query("select distinct accommodation.timeZoneId from Accommodation accommodation")
	List<String> findDistinctTimeZoneIds();

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select a from Accommodation a where a.id = :id")
	Optional<Accommodation> lockForMedia(@Param("id") Long id);
}
