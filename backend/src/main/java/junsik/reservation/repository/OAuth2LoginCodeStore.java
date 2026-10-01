package junsik.reservation.repository;

import java.time.Duration;
import java.util.Optional;

import junsik.reservation.enums.MemberRole;

public interface OAuth2LoginCodeStore {

	record Identity(Long memberId, MemberRole role) {
	}

	void save(String code, Identity identity, Duration ttl);

	Optional<Identity> consume(String code);
}
