package junsik.reservation.repository;

import java.time.Duration;
import java.util.Optional;

public interface RefreshTokenStore {

	void save(Long memberId, String refreshToken, Duration ttl);

	Optional<String> findByMemberId(Long memberId);

	void delete(Long memberId);
}
