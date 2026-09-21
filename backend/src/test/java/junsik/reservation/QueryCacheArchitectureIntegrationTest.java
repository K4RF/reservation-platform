package junsik.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.TestPropertySource;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.accommodation.request.AccommodationBookingPolicyRequest;
import junsik.reservation.dto.accommodation.request.AccommodationSearchRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationRequest;
import junsik.reservation.dto.common.response.PageResponse;
import junsik.reservation.dto.room.request.AvailableRoomRequest;
import junsik.reservation.dto.room.request.CreateRoomDailyPriceRequest;
import junsik.reservation.dto.room.request.RoomSearchRequest;
import junsik.reservation.dto.room.request.UpdateRoomDailyPriceRequest;
import junsik.reservation.dto.room.request.UpdateRoomInventoryRequest;
import junsik.reservation.dto.room.request.UpdateRoomRequest;
import junsik.reservation.dto.room.response.RoomResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationSortField;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomInventorySaleStatus;
import junsik.reservation.enums.RoomPriceSource;
import junsik.reservation.enums.RoomSortField;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.enums.SortDirection;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.accommodation.AccommodationBookingPolicyService;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.service.room.RoomDailyPriceService;
import junsik.reservation.service.room.RoomInventoryService;
import junsik.reservation.service.room.RoomService;
import junsik.reservation.support.MySqlRedisIntegrationTestSupport;

@TestPropertySource(properties = {
		"reservation.cache.enabled=true",
		"reservation.cache.detail-ttl=10m"
})
class QueryCacheArchitectureIntegrationTest extends MySqlRedisIntegrationTestSupport {

	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2035, 5, 10);
	private static final LocalDate CHECK_OUT_DATE = LocalDate.of(2035, 5, 13);

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private AccommodationBookingPolicyService bookingPolicyService;

	@Autowired
	private RoomService roomService;

	@Autowired
	private RoomInventoryService roomInventoryService;

	@Autowired
	private RoomDailyPriceService roomDailyPriceService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redisTemplate;

	private Long accommodationId;
	private Long roomId;

	@BeforeEach
	void setUp() {
		clearCache(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE);
		clearCache(RedisCacheConfig.ROOM_DETAIL_CACHE);

		Accommodation accommodation = accommodationRepository.saveAndFlush(Accommodation.create(
				"Final Query Hotel",
				"Query and cache architecture regression fixture",
				"KR",
				"Seoul",
				"Gangnam",
				"119 Test Road",
				Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.POOL),
				LocalTime.of(15, 0),
				LocalTime.of(11, 0),
				"Asia/Seoul"
		));
		Room room = roomRepository.saveAndFlush(Room.create(
				accommodation,
				"Final Query Room",
				4,
				new BigDecimal("100000.00"),
				Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
		));
		accommodationId = accommodation.getId();
		roomId = room.getId();

		bookingPolicyService.create(
				accommodationId,
				new AccommodationBookingPolicyRequest(2, 5, 0, 10_000)
		);
		CHECK_IN_DATE.datesUntil(CHECK_OUT_DATE)
				.forEach(date -> roomInventoryService.create(roomId, date, 2));
		roomDailyPriceService.create(
				roomId,
				new CreateRoomDailyPriceRequest(CHECK_IN_DATE, new BigDecimal("125000.00"))
		);
	}

	@Test
	void preservesReadBehaviorAndDatabaseTruthAcrossQueryCacheAndAdminChanges() {
		assertFinalSearchQueries();
		assertPriceSources();
		assertDetailCacheInvalidationAfterAdminChanges();
		assertUncachedAvailabilityReflectsInventoryAndPolicyChanges();
		assertUncachedPriceReflectsAdminChange();
	}

	private void assertFinalSearchQueries() {
		var accommodations = accommodationService.getAll(accommodationSearch("Final Query", true));
		assertThat(accommodations.content())
				.extracting(response -> response.accommodationId())
				.containsExactly(accommodationId);

		PageResponse<RoomResponse> rooms = roomService.getAllByAccommodation(
				accommodationId,
				new RoomSearchRequest(
						4,
						new BigDecimal("90000.00"),
						new BigDecimal("110000.00"),
						RoomStatus.ACTIVE,
						Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER),
						0,
						20,
						RoomSortField.ID,
						SortDirection.ASC
				)
		);
		assertThat(rooms.content())
				.extracting(RoomResponse::roomId)
				.containsExactly(roomId);

		assertThat(availableRooms().content())
				.extracting(RoomResponse::roomId)
				.containsExactly(roomId);
	}

	private void assertPriceSources() {
		var daily = roomDailyPriceService.getEffectivePrice(roomId, CHECK_IN_DATE);
		var fallback = roomDailyPriceService.getEffectivePrice(roomId, CHECK_IN_DATE.plusDays(1));

		assertThat(daily.source()).isEqualTo(RoomPriceSource.DAILY);
		assertThat(daily.nightlyPrice()).isEqualByComparingTo("125000.00");
		assertThat(fallback.source()).isEqualTo(RoomPriceSource.DEFAULT);
		assertThat(fallback.nightlyPrice()).isEqualByComparingTo("100000.00");
	}

	private void assertDetailCacheInvalidationAfterAdminChanges() {
		accommodationService.getById(accommodationId);
		roomService.getById(roomId);
		String accommodationKey = cacheKey(
				RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
				accommodationId
		);
		String roomKey = cacheKey(RedisCacheConfig.ROOM_DETAIL_CACHE, roomId);
		assertThat(redisTemplate.hasKey(accommodationKey)).isTrue();
		assertThat(redisTemplate.hasKey(roomKey)).isTrue();

		accommodationService.update(
				accommodationId,
				new UpdateAccommodationRequest(
						"Updated Query Hotel",
						"Updated from the database source of truth",
						"KR",
						"Seoul",
						"Gangnam",
						"119 Updated Road",
						Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.POOL),
						LocalTime.of(16, 0),
						LocalTime.of(12, 0),
						"Asia/Seoul"
				)
		);
		roomService.update(
				roomId,
				new UpdateRoomRequest(
						"Updated Query Room",
						4,
						new BigDecimal("110000.00"),
						Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
				)
		);

		assertKeyEventuallyAbsent(accommodationKey);
		assertKeyEventuallyAbsent(roomKey);
		assertThat(accommodationService.getById(accommodationId).name())
				.isEqualTo("Updated Query Hotel");
		assertThat(roomService.getById(roomId).name()).isEqualTo("Updated Query Room");
		assertThat(roomDailyPriceService.getEffectivePrice(roomId, CHECK_IN_DATE.plusDays(1))
				.nightlyPrice()).isEqualByComparingTo("110000.00");

		assertThat(accommodationService.getAll(accommodationSearch("Final Query", true)).content())
				.isEmpty();
		assertThat(accommodationService.getAll(accommodationSearch("Updated Query", true)).content())
				.hasSize(1);
	}

	private void assertUncachedAvailabilityReflectsInventoryAndPolicyChanges() {
		LocalDate middleDate = CHECK_IN_DATE.plusDays(1);
		roomInventoryService.update(
				roomId,
				middleDate,
				new UpdateRoomInventoryRequest(2, RoomInventorySaleStatus.CLOSED)
		);
		assertThat(availableRooms().content()).isEmpty();
		assertThat(accommodationService.getAll(accommodationSearch("Updated Query", true)).content())
				.isEmpty();

		roomInventoryService.update(
				roomId,
				middleDate,
				new UpdateRoomInventoryRequest(2, RoomInventorySaleStatus.OPEN)
		);
		assertThat(availableRooms().content()).hasSize(1);

		bookingPolicyService.update(
				accommodationId,
				new AccommodationBookingPolicyRequest(4, 5, 0, 10_000)
		);
		assertThat(accommodationService.getAll(accommodationSearch("Updated Query", true)).content())
				.isEmpty();

		bookingPolicyService.update(
				accommodationId,
				new AccommodationBookingPolicyRequest(2, 5, 0, 10_000)
		);
		assertThat(accommodationService.getAll(accommodationSearch("Updated Query", true)).content())
				.hasSize(1);
	}

	private void assertUncachedPriceReflectsAdminChange() {
		roomDailyPriceService.update(
				roomId,
				CHECK_IN_DATE,
				new UpdateRoomDailyPriceRequest(new BigDecimal("135000.00"))
		);
		assertThat(roomDailyPriceService.getEffectivePrice(roomId, CHECK_IN_DATE).nightlyPrice())
				.isEqualByComparingTo("135000.00");
	}

	private AccommodationSearchRequest accommodationSearch(String name, boolean available) {
		return new AccommodationSearchRequest(
				name,
				"Seoul",
				"Gangnam",
				Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.POOL),
				Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER),
				CHECK_IN_DATE,
				CHECK_OUT_DATE,
				4,
				new BigDecimal("90000.00"),
				new BigDecimal("120000.00"),
				AccommodationStatus.ACTIVE,
				available,
				0,
				20,
				AccommodationSortField.ID,
				SortDirection.ASC
		);
	}

	private PageResponse<RoomResponse> availableRooms() {
		return roomService.getAvailableRooms(
				accommodationId,
				new AvailableRoomRequest(CHECK_IN_DATE, CHECK_OUT_DATE, 4),
				0,
				20
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
}
