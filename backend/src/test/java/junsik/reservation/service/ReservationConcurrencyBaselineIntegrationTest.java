package junsik.reservation.service;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

class ReservationConcurrencyBaselineIntegrationTest extends MySqlIntegrationTestSupport {

	private static final int CONCURRENT_REQUESTS = 2;
	private static final int TOTAL_QUANTITY = 1;
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2036, 1, 10);
	private static final LocalDate CHECK_OUT_DATE = CHECK_IN_DATE.plusDays(1);

	@Autowired
	private ReservationService reservationService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private ExecutorService executor;
	private CyclicBarrier inventoryReadBarrier;
	private ReservationService reservationServiceTarget;
	private Member member;
	private Room room;

	@BeforeEach
	void setUp() {
		String fixtureId = UUID.randomUUID().toString();
		Accommodation accommodation = accommodationRepository.saveAndFlush(
				accommodation("Concurrency Baseline " + fixtureId)
		);
		room = roomRepository.saveAndFlush(room(accommodation));
		member = memberRepository.saveAndFlush(member("concurrency-" + fixtureId + "@example.com"));
		roomInventoryRepository.saveAndFlush(
				RoomInventory.create(room, CHECK_IN_DATE, TOTAL_QUANTITY)
		);

		inventoryReadBarrier = new CyclicBarrier(CONCURRENT_REQUESTS);
		RoomInventoryRepository synchronizedRepository = (RoomInventoryRepository) Proxy.newProxyInstance(
				RoomInventoryRepository.class.getClassLoader(),
				new Class<?>[]{RoomInventoryRepository.class},
				(proxy, method, arguments) -> {
					try {
						Object result = method.invoke(roomInventoryRepository, arguments);
						if (method.getName().equals(
								"findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc"
						)) {
							inventoryReadBarrier.await(10, TimeUnit.SECONDS);
						}
						return result;
					} catch (InvocationTargetException exception) {
						throw exception.getTargetException();
					}
				}
		);
		reservationServiceTarget = AopTestUtils.getUltimateTargetObject(reservationService);
		ReflectionTestUtils.setField(
				reservationServiceTarget,
				"roomInventoryRepository",
				synchronizedRepository
		);
		executor = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
	}

	@AfterEach
	void tearDown() throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(10, TimeUnit.SECONDS);
		ReflectionTestUtils.setField(
				reservationServiceTarget,
				"roomInventoryRepository",
				roomInventoryRepository
		);
	}

	@RepeatedTest(5)
	@Timeout(30)
	void reproducesOversellingWhenTransactionsReadTheSameLastInventory() throws Exception {
		CountDownLatch ready = new CountDownLatch(CONCURRENT_REQUESTS);
		CountDownLatch start = new CountDownLatch(1);
		CreateReservationRequest request = request(room.getId());

		List<Future<ReservationAttempt>> futures = java.util.stream.IntStream
				.range(0, CONCURRENT_REQUESTS)
				.mapToObj(index -> executor.submit(() -> attemptReservation(ready, start, request)))
				.toList();

		assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
		start.countDown();
		List<ReservationAttempt> attempts = futures.stream()
				.map(this::getResult)
				.toList();

		long successfulReservations = attempts.stream()
				.filter(ReservationAttempt::succeeded)
				.count();
		Integer persistedReservations = jdbcTemplate.queryForObject(
				"select count(*) from reservations where room_id = ?",
				Integer.class,
				room.getId()
		);
		InventoryState inventory = jdbcTemplate.queryForObject(
				"select total_quantity, reserved_quantity from room_inventories"
						+ " where room_id = ? and inventory_date = ?",
				(rowSet, rowNumber) -> new InventoryState(
						rowSet.getInt("total_quantity"),
						rowSet.getInt("reserved_quantity")
				),
				room.getId(),
				CHECK_IN_DATE
		);

		assertThat(attempts).allMatch(ReservationAttempt::succeeded);
		assertThat(successfulReservations).isEqualTo(CONCURRENT_REQUESTS);
		assertThat(persistedReservations).isEqualTo(CONCURRENT_REQUESTS);
		assertThat(inventory.totalQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(inventory.reservedQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(inventory.availableQuantity()).isZero();
		assertThat(persistedReservations).isGreaterThan(inventory.totalQuantity());
	}

	private ReservationAttempt attemptReservation(
			CountDownLatch ready,
			CountDownLatch start,
			CreateReservationRequest request
	) {
		ready.countDown();
		try {
			if (!start.await(10, TimeUnit.SECONDS)) {
				return ReservationAttempt.failed(new IllegalStateException("동시 요청 시작 대기 시간이 초과되었습니다."));
			}
			reservationService.create(member.getId(), request);
			return ReservationAttempt.success();
		} catch (Throwable throwable) {
			return ReservationAttempt.failed(throwable);
		}
	}

	private ReservationAttempt getResult(Future<ReservationAttempt> future) {
		try {
			return future.get(20, TimeUnit.SECONDS);
		} catch (Exception exception) {
			return ReservationAttempt.failed(exception);
		}
	}

	private CreateReservationRequest request(Long roomId) {
		return new CreateReservationRequest(
				roomId,
				1,
				CHECK_IN_DATE,
				CHECK_OUT_DATE,
				new RepresentativeGuestRequest(
						"Concurrency Guest",
						"concurrency-guest@example.com",
						"010-1234-5678"
				)
		);
	}

	private record ReservationAttempt(boolean succeeded, Throwable failure) {

		private static ReservationAttempt success() {
			return new ReservationAttempt(true, null);
		}

		private static ReservationAttempt failed(Throwable failure) {
			return new ReservationAttempt(false, failure);
		}
	}

	private record InventoryState(int totalQuantity, int reservedQuantity) {

		private int availableQuantity() {
			return totalQuantity - reservedQuantity;
		}
	}
}
