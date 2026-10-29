package junsik.reservation.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import junsik.reservation.entity.media.MediaFileCleanup;

public interface MediaFileCleanupRepository extends JpaRepository<MediaFileCleanup, String> {
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select task from MediaFileCleanup task where task.storageKey = :key")
	Optional<MediaFileCleanup> lockByKey(@Param("key") String key);

	// Do not lock the due-time secondary index before acquiring the same PK lock as uploaders.
	@Query("select task.storageKey from MediaFileCleanup task where task.nextAttemptAt <= :now order by task.nextAttemptAt, task.storageKey")
	List<String> findDueKeys(@Param("now") Instant now, Pageable pageable);
}
