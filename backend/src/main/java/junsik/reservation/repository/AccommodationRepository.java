package junsik.reservation.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import junsik.reservation.entity.Accommodation;

public interface AccommodationRepository extends
		JpaRepository<Accommodation, Long>,
		JpaSpecificationExecutor<Accommodation> {

	@Query("select distinct accommodation.timeZoneId from Accommodation accommodation")
	List<String> findDistinctTimeZoneIds();
}
