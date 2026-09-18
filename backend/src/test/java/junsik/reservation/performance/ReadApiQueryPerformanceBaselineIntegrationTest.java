package junsik.reservation.performance;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
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
	private static final int ACCOMMODATION_COUNT = ReadApiPerformanceFixture.ACCOMMODATION_COUNT;
	private static final int ROOMS_PER_ACCOMMODATION = ReadApiPerformanceFixture.ROOMS_PER_ACCOMMODATION;
	private static final int STAY_NIGHTS = ReadApiPerformanceFixture.STAY_NIGHTS;
	private static final int WARM_UP_RUNS = 1;
	private static final int MEASURED_RUNS = 5;
	private static final LocalDate CHECK_IN_DATE = ReadApiPerformanceFixture.CHECK_IN_DATE;
	private static final LocalDate CHECK_OUT_DATE = ReadApiPerformanceFixture.CHECK_OUT_DATE;

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
		ReadApiPerformanceFixture.Fixture fixture = performanceFixture().create(fixtureNamePrefix);
		accommodationId = fixture.accommodationId();
		roomId = fixture.roomId();
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
		assertThat(search.result().content()).allSatisfy(accommodation ->
				assertThat(accommodation.amenities()).containsExactlyInAnyOrder(
						AccommodationAmenity.PARKING,
						AccommodationAmenity.BREAKFAST
				)
		);
		assertThat(detail.result().accommodationId()).isEqualTo(accommodationId);
		assertThat(detail.result().amenities()).containsExactlyInAnyOrder(
				AccommodationAmenity.PARKING,
				AccommodationAmenity.BREAKFAST
		);
		assertThat(rooms.result().content()).hasSize(3);
		assertThat(rooms.result().totalElements()).isEqualTo(ROOMS_PER_ACCOMMODATION);
		assertThat(rooms.result().content()).allSatisfy(room ->
				assertThat(room.amenities()).containsExactlyInAnyOrder(
						RoomAmenity.WIFI,
						RoomAmenity.AIR_CONDITIONER
				)
		);
		assertThat(availableRooms.result().content()).hasSize(3);
		assertThat(availableRooms.result().totalElements()).isEqualTo(ROOMS_PER_ACCOMMODATION);
		assertThat(availableRooms.result().content()).allSatisfy(room ->
				assertThat(room.amenities()).containsExactlyInAnyOrder(
						RoomAmenity.WIFI,
						RoomAmenity.AIR_CONDITIONER
				)
		);
		assertThat(effectivePrice.result().roomId()).isEqualTo(roomId);
		assertThat(effectivePrice.result().nightlyPrice()).isEqualByComparingTo("120000.00");
		assertQueryBaseline(search, 4, 1);
		assertQueryBaseline(detail, 2, 1);
		assertQueryBaseline(rooms, 4, 1);
		assertQueryBaseline(availableRooms, 5, 1);
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

	private ReadApiPerformanceFixture performanceFixture() {
		return new ReadApiPerformanceFixture(
				accommodationRepository,
				bookingPolicyRepository,
				roomRepository,
				roomInventoryRepository,
				roomDailyPriceRepository
		);
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
		long averageNanos = Math.round(elapsedNanos.stream().mapToLong(Long::longValue).average().orElseThrow());
		int p95Index = (int) Math.ceil(sorted.size() * 0.95) - 1;
		QueryMeasurement measurement = new QueryMeasurement(
				api,
				statementCounts.getFirst(),
				entityLoadCount,
				collectionFetchCount,
				Duration.ofNanos(sorted.getFirst()),
				Duration.ofNanos(averageNanos),
				Duration.ofNanos(sorted.get(sorted.size() / 2)),
				Duration.ofNanos(sorted.get(p95Index)),
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
			Duration average,
			Duration p50,
			Duration p95,
			Duration maximum,
			List<String> sql
	) {
	}
}
