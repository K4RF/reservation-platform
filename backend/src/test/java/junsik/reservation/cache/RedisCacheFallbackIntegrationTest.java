package junsik.reservation.cache;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import io.lettuce.core.RedisCommandTimeoutException;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.support.RedisIntegrationTestSupport;

@SpringBootTest(properties = {
		"reservation.cache.enabled=true",
		"reservation.cache.detail-ttl=10m",
		"spring.jpa.properties.hibernate.generate_statistics=true"
})
class RedisCacheFallbackIntegrationTest extends RedisIntegrationTestSupport {

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@MockitoBean
	private LettuceConnectionFactory redisConnectionFactory;

	private LettuceConnectionFactory availableConnectionFactory;
	private Statistics statistics;
	private AtomicBoolean cacheAvailable;

	@BeforeEach
	void setUp() {
		availableConnectionFactory = new LettuceConnectionFactory(
				new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379))
		);
		availableConnectionFactory.afterPropertiesSet();
		availableConnectionFactory.getConnection().serverCommands().flushDb();
		statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.setStatisticsEnabled(true);
		cacheAvailable = new AtomicBoolean(false);
		when(redisConnectionFactory.getConnection()).thenAnswer(invocation -> {
			if (!cacheAvailable.get()) {
				throw new RedisConnectionFailureException("simulated cache connection failure");
			}
			return availableConnectionFactory.getConnection();
		});
	}

	@AfterEach
	void tearDown() {
		availableConnectionFactory.destroy();
	}

	@Test
	void fallsBackToDatabaseDuringConnectionFailureAndCachesAgainAfterRecovery() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		entityManager.clear();
		statistics.clear();

		AccommodationResponse fallback = accommodationService.getById(accommodation.getId());

		assertThat(fallback.accommodationId()).isEqualTo(accommodation.getId());
		assertThat(statistics.getPrepareStatementCount()).isPositive();

		cacheAvailable.set(true);
		statistics.clear();
		accommodationService.getById(accommodation.getId());
		assertThat(statistics.getPrepareStatementCount()).isPositive();

		statistics.clear();
		accommodationService.getById(accommodation.getId());
		assertThat(statistics.getPrepareStatementCount()).isZero();
	}

	@Test
	void fallsBackToDatabaseWhenRedisCommandTimesOut() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		entityManager.clear();
		doThrow(new RedisSystemException(
				"simulated cache command timeout",
				new RedisCommandTimeoutException("simulated timeout")
		)).when(redisConnectionFactory).getConnection();
		statistics.clear();

		AccommodationResponse fallback = accommodationService.getById(accommodation.getId());

		assertThat(fallback.accommodationId()).isEqualTo(accommodation.getId());
		assertThat(statistics.getPrepareStatementCount()).isPositive();
	}
}
