package junsik.reservation.cache;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationStatusRequest;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.dto.room.request.UpdateRoomRequest;
import junsik.reservation.dto.room.request.UpdateRoomStatusRequest;
import junsik.reservation.dto.room.response.RoomResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.service.room.RoomService;
import junsik.reservation.support.RedisIntegrationTestSupport;

@SpringBootTest(properties = {
		"reservation.cache.enabled=true",
		"reservation.cache.detail-ttl=10m",
		"spring.jpa.properties.hibernate.generate_statistics=true"
})
class RedisDetailCacheIntegrationTest extends RedisIntegrationTestSupport {

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private RoomService roomService;

	@MockitoSpyBean
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redisTemplate;

	private Statistics statistics;

	@BeforeEach
	void setUp() {
		statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.setStatisticsEnabled(true);
		clearCache(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE);
		clearCache(RedisCacheConfig.ROOM_DETAIL_CACHE);
	}

	@Test
	void returnsAccommodationAndRoomFromRedisWithoutAnotherDatabaseQuery() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		Room room = roomRepository.saveAndFlush(room(accommodation));
		entityManager.clear();

		AccommodationResponse firstAccommodation = accommodationService.getById(accommodation.getId());
		RoomResponse firstRoom = roomService.getById(room.getId());
		assertThat(statistics.getPrepareStatementCount()).isPositive();
		assertThat(redisTemplate.hasKey(cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodation.getId()
		))).isTrue();
		assertThat(redisTemplate.hasKey(cacheKey(
				RedisCacheConfig.ROOM_DETAIL_CACHE,
				room.getId()
		))).isTrue();

		entityManager.clear();
		statistics.clear();
		AccommodationResponse cachedAccommodation = accommodationService.getById(accommodation.getId());
		RoomResponse cachedRoom = roomService.getById(room.getId());

		assertThat(cachedAccommodation).isEqualTo(firstAccommodation);
		assertThat(cachedRoom).isEqualTo(firstRoom);
		assertThat(statistics.getPrepareStatementCount()).isZero();
	}

	@Test
	void coalescesConcurrentMissesForTheSameAccommodation() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		entityManager.clear();
		statistics.clear();
		clearInvocations(accommodationRepository);
		int requestCount = 20;
		CountDownLatch ready = new CountDownLatch(requestCount);
		CountDownLatch start = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(requestCount)) {
			List<Future<AccommodationResponse>> futures = new ArrayList<>();
			for (int index = 0; index < requestCount; index++) {
				futures.add(executor.submit(() -> {
					ready.countDown();
					start.await();
					return accommodationService.getById(accommodation.getId());
				}));
			}
			assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
			start.countDown();

			for (Future<AccommodationResponse> future : futures) {
				assertThat(future.get(5, TimeUnit.SECONDS).accommodationId())
						.isEqualTo(accommodation.getId());
			}
		}

		verify(accommodationRepository, times(1)).findById(accommodation.getId());
		assertThat(statistics.getPrepareStatementCount()).isPositive();
		assertThat(redisTemplate.hasKey(cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodation.getId()
		))).isTrue();
	}

	@Test
	void reloadsAccommodationFromDatabaseAfterTtlExpires() throws InterruptedException {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		entityManager.clear();
		accommodationService.getById(accommodation.getId());
		String key = cacheKey(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE, accommodation.getId());
		Long initialTtl = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
		assertThat(initialTtl).isPositive().isLessThanOrEqualTo(600_000L);
		assertThat(redisTemplate.expire(key, 100L, TimeUnit.MILLISECONDS)).isTrue();

		Thread.sleep(250L);
		assertThat(redisTemplate.hasKey(key)).isFalse();

		entityManager.clear();
		statistics.clear();
		accommodationService.getById(accommodation.getId());

		assertThat(statistics.getPrepareStatementCount()).isPositive();
	}

	@Test
	void evictsDetailCachesAfterInformationUpdates() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		Room room = roomRepository.saveAndFlush(room(accommodation));
		entityManager.clear();
		accommodationService.getById(accommodation.getId());
		roomService.getById(room.getId());
		String accommodationKey = cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodation.getId()
		);
		String roomKey = cacheKey(RedisCacheConfig.ROOM_DETAIL_CACHE, room.getId());

		accommodationService.update(
				accommodation.getId(),
				new UpdateAccommodationRequest(
						"Updated Accommodation",
						"Updated description",
						"대한민국",
						"서울특별시",
						"강남구",
						"Updated address",
						Set.of(AccommodationAmenity.PARKING),
						LocalTime.of(15, 0),
						LocalTime.of(11, 0),
						"Asia/Seoul"
				)
		);
		roomService.update(
				room.getId(),
				new UpdateRoomRequest(
						"Updated Room",
						4,
						new BigDecimal("150000.00"),
						Set.of(RoomAmenity.WIFI)
				)
		);

		assertKeyEventuallyAbsent(accommodationKey);
		assertKeyEventuallyAbsent(roomKey);
		entityManager.clear();
		assertThat(accommodationService.getById(accommodation.getId()).name())
				.isEqualTo("Updated Accommodation");
		assertThat(roomService.getById(room.getId()).name()).isEqualTo("Updated Room");
	}

	@Test
	void evictsDetailCachesAfterStatusChanges() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		Room room = roomRepository.saveAndFlush(room(accommodation));
		entityManager.clear();
		accommodationService.getById(accommodation.getId());
		roomService.getById(room.getId());
		String accommodationKey = cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodation.getId()
		);
		String roomKey = cacheKey(RedisCacheConfig.ROOM_DETAIL_CACHE, room.getId());

		accommodationService.updateStatus(
				accommodation.getId(),
				new UpdateAccommodationStatusRequest(AccommodationStatus.INACTIVE)
		);
		roomService.updateStatus(room.getId(), new UpdateRoomStatusRequest(RoomStatus.INACTIVE));

		assertKeyEventuallyAbsent(accommodationKey);
		assertKeyEventuallyAbsent(roomKey);
		entityManager.clear();
		assertThat(accommodationService.getById(accommodation.getId()).status())
				.isEqualTo(AccommodationStatus.INACTIVE);
		assertThat(roomService.getById(room.getId()).status()).isEqualTo(RoomStatus.INACTIVE);
	}

	private void clearCache(String cacheName) {
		Cache cache = cacheManager.getCache(cacheName);
		assertThat(cache).isNotNull();
		cache.clear();
	}

	private String cacheKey(String cacheName, Long id) {
		return RedisCacheConfig.KEY_PREFIX + cacheName + "::" + id;
	}

	private void assertKeyEventuallyAbsent(String key) {
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
}
