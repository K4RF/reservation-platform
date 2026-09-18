package junsik.reservation.performance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.TestPropertySource;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomDailyPriceRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.support.MySqlRedisIntegrationTestSupport;

@TestPropertySource(properties = {
		"reservation.cache.enabled=true",
		"spring.jpa.properties.hibernate.generate_statistics=true"
})
class CacheReadPerformanceComparisonIntegrationTest extends MySqlRedisIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(
			CacheReadPerformanceComparisonIntegrationTest.class
	);
	private static final int MEASURED_RUNS = 5;

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private AccommodationBookingPolicyRepository bookingPolicyRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private RoomDailyPriceRepository roomDailyPriceRepository;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redisTemplate;

	private Statistics statistics;
	private Long accommodationId;

	@BeforeEach
	void setUp() {
		statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.setStatisticsEnabled(true);
		ReadApiPerformanceFixture.Fixture fixture = new ReadApiPerformanceFixture(
				accommodationRepository,
				bookingPolicyRepository,
				roomRepository,
				roomInventoryRepository,
				roomDailyPriceRepository
		).create("Cache Comparison " + UUID.randomUUID());
		accommodationId = fixture.accommodationId();
		accommodationDetailCache().clear();
	}

	@Test
	@Timeout(60)
	void comparesColdMissAndWarmHitWithTheQueryBaselineFixture() {
		CacheMeasurement cold = measure("cold-miss", this::evictAccommodationDetail);
		CacheMeasurement warm = measure("warm-hit", () -> { });

		assertThat(cold.preparedStatementCount()).isEqualTo(2L);
		assertThat(cold.databaseAccessReductionPercent()).isZero();
		assertThat(warm.preparedStatementCount()).isZero();
		assertThat(warm.databaseAccessReductionPercent()).isEqualTo(100.0);
		log.info("Accommodation detail cache comparison: cold={}", cold);
		log.info("Accommodation detail cache comparison: warm={}", warm);
	}

	private CacheMeasurement measure(String cacheState, Runnable beforeEachRun) {
		List<Long> elapsedNanos = new ArrayList<>();
		List<Long> statementCounts = new ArrayList<>();
		AccommodationResponse result = null;

		for (int run = 0; run < MEASURED_RUNS; run++) {
			beforeEachRun.run();
			statistics.clear();
			long startedAt = System.nanoTime();
			result = accommodationService.getById(accommodationId);
			elapsedNanos.add(System.nanoTime() - startedAt);
			statementCounts.add(statistics.getPrepareStatementCount());
		}

		assertThat(result).isNotNull();
		assertThat(result.accommodationId()).isEqualTo(accommodationId);
		assertThat(statementCounts).containsOnly(statementCounts.getFirst());
		List<Long> sorted = elapsedNanos.stream().sorted().toList();
		long averageNanos = Math.round(elapsedNanos.stream().mapToLong(Long::longValue).average().orElseThrow());
		int p95Index = (int) Math.ceil(sorted.size() * 0.95) - 1;
		long baselineStatements = 2L;
		double reduction = (baselineStatements - statementCounts.getFirst()) * 100.0
				/ baselineStatements;
		return new CacheMeasurement(
				cacheState,
				MEASURED_RUNS,
				statementCounts.getFirst(),
				reduction,
				Duration.ofNanos(averageNanos),
				Duration.ofNanos(sorted.get(sorted.size() / 2)),
				Duration.ofNanos(sorted.get(p95Index))
		);
	}

	private void evictAccommodationDetail() {
		accommodationDetailCache().evict(accommodationId);
		String key = RedisCacheConfig.KEY_PREFIX
				+ RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE
				+ "::"
				+ accommodationId;
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
		while (Boolean.TRUE.equals(redisTemplate.hasKey(key)) && System.nanoTime() < deadline) {
			try {
				Thread.sleep(20L);
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("Interrupted while waiting for cache eviction", exception);
			}
		}
		assertThat(redisTemplate.hasKey(key)).isFalse();
	}

	private Cache accommodationDetailCache() {
		Cache cache = cacheManager.getCache(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE);
		assertThat(cache).isNotNull();
		return cache;
	}

	private record CacheMeasurement(
			String cacheState,
			int measuredRuns,
			long preparedStatementCount,
			double databaseAccessReductionPercent,
			Duration average,
			Duration p50,
			Duration p95
	) {
	}
}
