package junsik.reservation.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class RedisRefreshTokenStoreTest {

	@Mock
	private StringRedisTemplate redisTemplate;

	@Mock
	private ValueOperations<String, String> valueOperations;

	private RedisRefreshTokenStore refreshTokenStore;

	@BeforeEach
	void setUp() {
		when(redisTemplate.opsForValue()).thenReturn(valueOperations);
		refreshTokenStore = new RedisRefreshTokenStore(redisTemplate);
	}

	@Test
	void storesRefreshTokenWithMemberKeyAndExpirationTtl() {
		Duration ttl = Duration.ofDays(14);

		refreshTokenStore.save(15L, "refresh-token", ttl);

		verify(valueOperations).set("refresh:15", "refresh-token", ttl);
	}

	@Test
	void findsAndDeletesRefreshTokenByMemberKey() {
		when(valueOperations.get("refresh:15")).thenReturn("refresh-token");

		assertThat(refreshTokenStore.findByMemberId(15L)).contains("refresh-token");
		refreshTokenStore.delete(15L);

		verify(redisTemplate).delete("refresh:15");
	}
}
