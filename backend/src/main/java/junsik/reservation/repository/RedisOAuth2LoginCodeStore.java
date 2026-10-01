package junsik.reservation.repository;

import java.time.Duration;
import java.util.Optional;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import junsik.reservation.enums.MemberRole;

@Repository
public class RedisOAuth2LoginCodeStore implements OAuth2LoginCodeStore {

	private static final String KEY_PREFIX = "oauth2:login-code:";
	private final StringRedisTemplate redisTemplate;

	public RedisOAuth2LoginCodeStore(StringRedisTemplate redisTemplate) {
		this.redisTemplate = redisTemplate;
	}

	@Override
	public void save(String code, Identity identity, Duration ttl) {
		redisTemplate.opsForValue().set(KEY_PREFIX + code,
				identity.memberId() + ":" + identity.role().name(), ttl);
	}

	@Override
	public Optional<Identity> consume(String code) {
		String value = redisTemplate.opsForValue().getAndDelete(KEY_PREFIX + code);
		if (value == null) return Optional.empty();
		String[] parts = value.split(":", 2);
		if (parts.length != 2) return Optional.empty();
		try {
			return Optional.of(new Identity(Long.valueOf(parts[0]), MemberRole.valueOf(parts[1])));
		} catch (IllegalArgumentException exception) {
			return Optional.empty();
		}
	}
}
