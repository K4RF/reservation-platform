package junsik.reservation.cache;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.TimeUnit;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationStatusRequest;
import junsik.reservation.dto.room.request.UpdateRoomStatusRequest;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.service.room.RoomService;
import junsik.reservation.support.RedisIntegrationTestSupport;

@SpringBootTest(properties = {
		"reservation.cache.enabled=true",
		"reservation.cache.detail-ttl=10m"
})
class RedisCacheInvalidationIntegrationTest extends RedisIntegrationTestSupport {

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private RoomService roomService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Autowired
	private PlatformTransactionManager transactionManager;

	private TransactionTemplate transactionTemplate;

	@BeforeEach
	void setUp() {
		transactionTemplate = new TransactionTemplate(transactionManager);
		clearCache(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE);
		clearCache(RedisCacheConfig.ROOM_DETAIL_CACHE);
	}

	@Test
	void defersMultipleCacheEvictionsUntilTransactionCommit() {
		CachedFixture fixture = createCachedFixture();

		transactionTemplate.executeWithoutResult(status -> {
			accommodationService.updateStatus(
					fixture.accommodationId(),
					new UpdateAccommodationStatusRequest(AccommodationStatus.INACTIVE)
			);
			roomService.updateStatus(
					fixture.roomId(),
					new UpdateRoomStatusRequest(RoomStatus.INACTIVE)
			);

			assertThat(redisTemplate.hasKey(fixture.accommodationCacheKey())).isTrue();
			assertThat(redisTemplate.hasKey(fixture.roomCacheKey())).isTrue();
		});

		assertKeyEventuallyAbsent(fixture.accommodationCacheKey());
		assertKeyEventuallyAbsent(fixture.roomCacheKey());
		entityManager.clear();
		assertThat(accommodationService.getById(fixture.accommodationId()).status())
				.isEqualTo(AccommodationStatus.INACTIVE);
		assertThat(roomService.getById(fixture.roomId()).status()).isEqualTo(RoomStatus.INACTIVE);
	}

	@Test
	void keepsDatabaseAndCacheValuesWhenTransactionRollsBack() {
		CachedFixture fixture = createCachedFixture();

		assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
			accommodationService.updateStatus(
					fixture.accommodationId(),
					new UpdateAccommodationStatusRequest(AccommodationStatus.INACTIVE)
			);
			roomService.updateStatus(
					fixture.roomId(),
					new UpdateRoomStatusRequest(RoomStatus.INACTIVE)
			);
			throw new IllegalStateException("force rollback after cache eviction was requested");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(redisTemplate.hasKey(fixture.accommodationCacheKey())).isTrue();
		assertThat(redisTemplate.hasKey(fixture.roomCacheKey())).isTrue();
		entityManager.clear();
		assertThat(accommodationService.getById(fixture.accommodationId()).status())
				.isEqualTo(AccommodationStatus.ACTIVE);
		assertThat(roomService.getById(fixture.roomId()).status()).isEqualTo(RoomStatus.ACTIVE);
		assertThat(accommodationRepository.findById(fixture.accommodationId()).orElseThrow().getStatus())
				.isEqualTo(AccommodationStatus.ACTIVE);
		assertThat(roomRepository.findById(fixture.roomId()).orElseThrow().getStatus())
				.isEqualTo(RoomStatus.ACTIVE);
	}

	private CachedFixture createCachedFixture() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		Room room = roomRepository.saveAndFlush(room(accommodation));
		entityManager.clear();
		accommodationService.getById(accommodation.getId());
		roomService.getById(room.getId());
		String accommodationCacheKey = cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodation.getId()
		);
		String roomCacheKey = cacheKey(RedisCacheConfig.ROOM_DETAIL_CACHE, room.getId());
		assertThat(redisTemplate.hasKey(accommodationCacheKey)).isTrue();
		assertThat(redisTemplate.hasKey(roomCacheKey)).isTrue();
		return new CachedFixture(
				accommodation.getId(),
				room.getId(),
				accommodationCacheKey,
				roomCacheKey
		);
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

	private record CachedFixture(
			Long accommodationId,
			Long roomId,
			String accommodationCacheKey,
			String roomCacheKey
	) {
	}
}
