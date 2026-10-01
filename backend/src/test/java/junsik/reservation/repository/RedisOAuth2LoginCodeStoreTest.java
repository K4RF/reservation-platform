package junsik.reservation.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.OAuth2LoginCodeStore.Identity;

class RedisOAuth2LoginCodeStoreTest {

	private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
	@SuppressWarnings("unchecked")
	private final ValueOperations<String, String> values = mock(ValueOperations.class);
	private final RedisOAuth2LoginCodeStore store = new RedisOAuth2LoginCodeStore(redisTemplate);

	@Test
	void storesAShortLivedIdentityAndConsumesItAtomically() {
		when(redisTemplate.opsForValue()).thenReturn(values);
		when(values.getAndDelete("oauth2:login-code:code"))
				.thenReturn("15:USER")
				.thenReturn(null);

		store.save("code", new Identity(15L, MemberRole.USER), Duration.ofSeconds(60));
		assertThat(store.consume("code")).contains(new Identity(15L, MemberRole.USER));
		assertThat(store.consume("code")).isEmpty();

		verify(values).set("oauth2:login-code:code", "15:USER", Duration.ofSeconds(60));
	}
}
