package junsik.reservation.performance;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.IntStream;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import junsik.reservation.dto.accommodation.request.AccommodationSearchRequest;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.dto.common.response.PageResponse;
import junsik.reservation.dto.room.request.AvailableRoomRequest;
import junsik.reservation.dto.room.request.RoomSearchRequest;
import junsik.reservation.dto.room.response.RoomDailyPriceResponse;
import junsik.reservation.dto.room.response.RoomResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.accommodation.AccommodationBookingPolicy;
import junsik.reservation.entity.room.Room;
import junsik.reservation.entity.room.RoomDailyPrice;
import junsik.reservation.entity.room.RoomInventory;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationSortField;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomSortField;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.enums.SortDirection;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomDailyPriceRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.service.room.RoomDailyPriceService;
import junsik.reservation.service.room.RoomService;
import junsik.reservation.support.MySqlIntegrationTestSupport;
import junsik.reservation.support.SqlCaptureStatementInspector;

@TestPropertySource(properties = {
		"spring.jpa.properties.hibernate.generate_statistics=true",
		"spring.jpa.properties.hibernate.session_factory.statement_inspector="
				+ "junsik.reservation.support.SqlCaptureStatementInspector"
})
class ReadApiQueryPerformanceBaselineIntegrationTest extends MySqlIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(
			ReadApiQueryPerformanceBaselineIntegrationTest.class
	);
	private static final int ACCOMMODATION_COUNT = 10;
	private static final int ROOMS_PER_ACCOMMODATION = 5;
	private static final int STAY_NIGHTS = 3;
	private static final int WARM_UP_RUNS = 1;
	private static final int MEASURED_RUNS = 5;
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2035, 5, 10);
	private static final LocalDate CHECK_OUT_DATE = CHECK_IN_DATE.plusDays(STAY_NIGHTS);

	@Autowired
	private AccommodationService accommodationService;

	@Autowired
	private RoomService roomService;

	@Autowired
	private RoomDailyPriceService roomDailyPriceService;

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

	private Statistics statistics;
	private String fixtureNamePrefix;
	private Long accommodationId;
	private Long roomId;

	@BeforeEach
	void setUp() {
		statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.setStatisticsEnabled(true);
		fixtureNamePrefix = "Query Baseline " + UUID.randomUUID();
		createFixture();
	}

	@Test
	@Timeout(60)
	void measuresMajorReadApiQueryBaseline() {
		AccommodationSearchRequest accommodationSearch = new AccommodationSearchRequest(
				fixtureNamePrefix,
				"Seoul",
				"Gangnam",
				Set.of(AccommodationAmenity.PARKING),
				Set.of(RoomAmenity.WIFI),
				CHECK_IN_DATE,
				CHECK_OUT_DATE,
				2,
				new BigDecimal("90000.00"),
				new BigDecimal("200000.00"),
				AccommodationStatus.ACTIVE,
				true,
				0,
				5,
				AccommodationSortField.ID,
				SortDirection.ASC
		);
		RoomSearchRequest roomSearch = new RoomSearchRequest(
				2,
				new BigDecimal("90000.00"),
				new BigDecimal("200000.00"),
				RoomStatus.ACTIVE,
				Set.of(RoomAmenity.WIFI),
				0,
				3,
				RoomSortField.ID,
				SortDirection.ASC
		);
		AvailableRoomRequest availableRoomRequest = new AvailableRoomRequest(
				CHECK_IN_DATE,
				CHECK_OUT_DATE,
				2
		);

		MeasuredCall<PageResponse<AccommodationResponse>> search = measure(
				"accommodation-search",
				() -> accommodationService.getAll(accommodationSearch)
		);
		MeasuredCall<AccommodationResponse> detail = measure(
				"accommodation-detail",
				() -> accommodationService.getById(accommodationId)
		);
		MeasuredCall<PageResponse<RoomResponse>> rooms = measure(
				"room-list",
				() -> roomService.getAllByAccommodation(accommodationId, roomSearch)
		);
		MeasuredCall<PageResponse<RoomResponse>> availableRooms = measure(
				"available-room-list",
				() -> roomService.getAvailableRooms(
						accommodationId,
						availableRoomRequest,
						0,
						3
				)
		);
		MeasuredCall<RoomDailyPriceResponse> effectivePrice = measure(
				"effective-room-price",
				() -> roomDailyPriceService.getEffectivePrice(roomId, CHECK_IN_DATE)
		);

		assertThat(search.result().content()).hasSize(5);
		assertThat(search.result().totalElements()).isEqualTo(ACCOMMODATION_COUNT);
		assertThat(detail.result().accommodationId()).isEqualTo(accommodationId);
		assertThat(rooms.result().content()).hasSize(3);
		assertThat(rooms.result().totalElements()).isEqualTo(ROOMS_PER_ACCOMMODATION);
		assertThat(availableRooms.result().content()).hasSize(3);
		assertThat(availableRooms.result().totalElements()).isEqualTo(ROOMS_PER_ACCOMMODATION);
		assertThat(effectivePrice.result().roomId()).isEqualTo(roomId);
		assertThat(effectivePrice.result().nightlyPrice()).isEqualByComparingTo("120000.00");
		assertQueryBaseline(search, 8, 5);
		assertQueryBaseline(detail, 2, 1);
		assertQueryBaseline(rooms, 6, 3);
		assertQueryBaseline(availableRooms, 7, 3);
		assertQueryBaseline(effectivePrice, 2, 0);

		List.of(search, detail, rooms, availableRooms, effectivePrice)
				.forEach(call -> {
					assertThat(call.measurement().sql()).isNotEmpty();
					log.info("Read API query baseline: {}", call.measurement());
				});
	}

	private void assertQueryBaseline(
			MeasuredCall<?> call,
			long expectedStatements,
			long expectedCollectionFetches
	) {
		assertThat(call.measurement().preparedStatementCount()).isEqualTo(expectedStatements);
		assertThat(call.measurement().sql()).hasSize((int) expectedStatements);
		assertThat(call.measurement().collectionFetchCount()).isEqualTo(expectedCollectionFetches);
	}

	private void createFixture() {
		List<Room> rooms = new ArrayList<>();
		List<RoomInventory> inventories = new ArrayList<>();
		List<RoomDailyPrice> dailyPrices = new ArrayList<>();

		for (int accommodationIndex = 0; accommodationIndex < ACCOMMODATION_COUNT; accommodationIndex++) {
			Accommodation accommodation = accommodationRepository.saveAndFlush(Accommodation.create(
					fixtureNamePrefix + " " + accommodationIndex,
					"Reproducible query performance fixture",
					"KR",
					"Seoul",
					"Gangnam",
					"Baseline address " + accommodationIndex,
					Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.BREAKFAST),
					LocalTime.of(15, 0),
					LocalTime.of(11, 0),
					"Asia/Seoul"
			));
			bookingPolicyRepository.save(AccommodationBookingPolicy.create(
					accommodation,
					1,
					30,
					0,
					10_000
			));
			for (int roomIndex = 0; roomIndex < ROOMS_PER_ACCOMMODATION; roomIndex++) {
				Room room = Room.create(
						accommodation,
						"Baseline Room " + accommodationIndex + "-" + roomIndex,
						4,
						new BigDecimal("100000.00").add(BigDecimal.valueOf(roomIndex * 1000L)),
						Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
				);
				rooms.add(room);
			}
		}
		bookingPolicyRepository.flush();
		roomRepository.saveAllAndFlush(rooms);
		for (Room room : rooms) {
			CHECK_IN_DATE.datesUntil(CHECK_OUT_DATE)
					.map(date -> RoomInventory.create(room, date, 3))
					.forEach(inventories::add);
			dailyPrices.add(RoomDailyPrice.create(
					room,
					CHECK_IN_DATE,
					new BigDecimal("120000.00")
			));
		}
		roomInventoryRepository.saveAllAndFlush(inventories);
		roomDailyPriceRepository.saveAllAndFlush(dailyPrices);
		accommodationId = rooms.getFirst().getAccommodation().getId();
		roomId = rooms.getFirst().getId();
	}

	private <T> MeasuredCall<T> measure(String api, Supplier<T> operation) {
		IntStream.range(0, WARM_UP_RUNS).forEach(index -> operation.get());
		List<Long> elapsedNanos = new ArrayList<>();
		List<Long> statementCounts = new ArrayList<>();
		T result = null;
		List<String> sql = List.of();
		long entityLoadCount = 0;
		long collectionFetchCount = 0;

		for (int run = 0; run < MEASURED_RUNS; run++) {
			statistics.clear();
			SqlCaptureStatementInspector.clear();
			long startedAt = System.nanoTime();
			result = operation.get();
			elapsedNanos.add(System.nanoTime() - startedAt);
			statementCounts.add(statistics.getPrepareStatementCount());
			if (run == 0) {
				sql = SqlCaptureStatementInspector.snapshot();
				entityLoadCount = statistics.getEntityLoadCount();
				collectionFetchCount = statistics.getCollectionFetchCount();
			}
		}

		assertThat(statementCounts).containsOnly(statementCounts.getFirst());
		List<Long> sorted = elapsedNanos.stream().sorted(Comparator.naturalOrder()).toList();
		QueryMeasurement measurement = new QueryMeasurement(
				api,
				statementCounts.getFirst(),
				entityLoadCount,
				collectionFetchCount,
				Duration.ofNanos(sorted.getFirst()),
				Duration.ofNanos(sorted.get(sorted.size() / 2)),
				Duration.ofNanos(sorted.getLast()),
				sql
		);
		return new MeasuredCall<>(result, measurement);
	}

	private record MeasuredCall<T>(T result, QueryMeasurement measurement) {
	}

	private record QueryMeasurement(
			String api,
			long preparedStatementCount,
			long entityLoadCount,
			long collectionFetchCount,
			Duration minimum,
			Duration median,
			Duration maximum,
			List<String> sql
	) {
	}
}
