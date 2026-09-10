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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.dto.reservation.request.UpdateReservationScheduleRequest;
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
	private ReservationService reservationServiceTarget;
	private CyclicBarrier inventoryReadBarrier;
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
		reservationServiceTarget = AopTestUtils.getUltimateTargetObject(reservationService);
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
	void detectsConcurrentReservationConflictWithOptimisticLock() throws Exception {
		assertConcurrentReservationsRemainConsistent(
				request(room.getId(), CHECK_IN_DATE, CHECK_OUT_DATE),
				List.of(CHECK_IN_DATE)
		);
	}

	@Test
	@Timeout(30)
	void rollsBackEveryStayDateWhenAConcurrentMultiNightReservationConflicts() throws Exception {
		List<LocalDate> stayDates = CHECK_IN_DATE.datesUntil(CHECK_IN_DATE.plusDays(3)).toList();
		stayDates.stream()
				.skip(1)
				.map(date -> RoomInventory.create(room, date, TOTAL_QUANTITY))
				.forEach(roomInventoryRepository::save);
		roomInventoryRepository.flush();

		assertConcurrentReservationsRemainConsistent(
				request(room.getId(), CHECK_IN_DATE, CHECK_IN_DATE.plusDays(3)),
				stayDates
		);
	}

	@Test
	@Timeout(30)
	void detectsOptimisticConflictBetweenScheduleChangeAndNewReservation() throws Exception {
		LocalDate previousCheckInDate = CHECK_IN_DATE.minusDays(1);
		roomInventoryRepository.saveAndFlush(
				RoomInventory.create(room, previousCheckInDate, TOTAL_QUANTITY)
		);
		Long reservationId = reservationService.create(
				member.getId(),
				request(room.getId(), previousCheckInDate, CHECK_IN_DATE)
		).reservationId();
		installInventoryReadBarrier();
		CountDownLatch ready = new CountDownLatch(CONCURRENT_REQUESTS);
		CountDownLatch start = new CountDownLatch(1);

		Future<ReservationAttempt> scheduleChange = executor.submit(() -> attemptOperation(
				ready,
				start,
				() -> reservationService.updateSchedule(
						member.getId(),
						reservationId,
						new UpdateReservationScheduleRequest(CHECK_IN_DATE, CHECK_OUT_DATE)
				)
		));
		Future<ReservationAttempt> newReservation = executor.submit(() -> attemptOperation(
				ready,
				start,
				() -> reservationService.create(
						member.getId(),
						request(room.getId(), CHECK_IN_DATE, CHECK_OUT_DATE)
				)
		));

		assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
		start.countDown();
		List<ReservationAttempt> attempts = List.of(
				getResult(scheduleChange),
				getResult(newReservation)
		);

		assertOneSuccessAndOneOptimisticLockFailure(attempts);
		assertThat(countConfirmedReservationsFor(previousCheckInDate))
				.isEqualTo(reservedQuantity(previousCheckInDate));
		assertThat(countConfirmedReservationsFor(CHECK_IN_DATE)).isOne();
		assertThat(reservedQuantity(CHECK_IN_DATE)).isEqualTo(TOTAL_QUANTITY);
	}

	@Test
	void cancellationRestoresInventoryAndIncrementsVersion() {
		Long reservationId = reservationService.create(
				member.getId(),
				request(room.getId(), CHECK_IN_DATE, CHECK_OUT_DATE)
		).reservationId();
		InventoryState reserved = inventoryState(CHECK_IN_DATE);

		reservationService.cancel(member.getId(), reservationId);

		InventoryState released = inventoryState(CHECK_IN_DATE);
		assertThat(reserved.reservedQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(reserved.version()).isOne();
		assertThat(released.reservedQuantity()).isZero();
		assertThat(released.version()).isEqualTo(2);
	}

	private void assertConcurrentReservationsRemainConsistent(
			CreateReservationRequest request,
			List<LocalDate> stayDates
	) throws Exception {
		installInventoryReadBarrier();
		CountDownLatch ready = new CountDownLatch(CONCURRENT_REQUESTS);
		CountDownLatch start = new CountDownLatch(1);

		List<Future<ReservationAttempt>> futures = java.util.stream.IntStream
				.range(0, CONCURRENT_REQUESTS)
				.mapToObj(index -> executor.submit(() -> attemptOperation(
						ready,
						start,
						() -> reservationService.create(member.getId(), request)
				)))
				.toList();

		assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
		start.countDown();
		List<ReservationAttempt> attempts = futures.stream()
				.map(this::getResult)
				.toList();

		Integer persistedReservations = jdbcTemplate.queryForObject(
				"select count(*) from reservations where room_id = ?",
				Integer.class,
				room.getId()
		);

		assertOneSuccessAndOneOptimisticLockFailure(attempts);
		assertThat(persistedReservations).isEqualTo(TOTAL_QUANTITY);
		stayDates.forEach(this::assertFullyReserved);
	}

	private ReservationAttempt attemptOperation(
			CountDownLatch ready,
			CountDownLatch start,
			Runnable operation
	) {
		ready.countDown();
		try {
			if (!start.await(10, TimeUnit.SECONDS)) {
				return ReservationAttempt.failed(new IllegalStateException("동시 요청 시작 대기 시간이 초과되었습니다."));
			}
			operation.run();
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

	private void assertFullyReserved(LocalDate inventoryDate) {
		InventoryState inventory = inventoryState(inventoryDate);
		assertThat(inventory.totalQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(inventory.reservedQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(inventory.availableQuantity()).isZero();
	}

	private void assertOneSuccessAndOneOptimisticLockFailure(List<ReservationAttempt> attempts) {
		assertThat(attempts).filteredOn(ReservationAttempt::succeeded).hasSize(TOTAL_QUANTITY);
		assertThat(attempts)
				.filteredOn(attempt -> !attempt.succeeded())
				.singleElement()
				.satisfies(attempt -> {
					assertThat(attempt.failure())
							.isInstanceOf(ObjectOptimisticLockingFailureException.class);
				});
	}

	private void installInventoryReadBarrier() {
		inventoryReadBarrier = new CyclicBarrier(CONCURRENT_REQUESTS);
		RoomInventoryRepository synchronizedRepository = (RoomInventoryRepository) Proxy.newProxyInstance(
				RoomInventoryRepository.class.getClassLoader(),
				new Class<?>[]{RoomInventoryRepository.class},
				(proxy, method, arguments) -> {
					try {
						Object result = method.invoke(roomInventoryRepository, arguments);
						if (method.getName().equals(
								"findAllByRoomIdAndInventoryDateInOrderByInventoryDateAsc"
						)) {
							inventoryReadBarrier.await(10, TimeUnit.SECONDS);
						}
						return result;
					} catch (InvocationTargetException exception) {
						throw exception.getTargetException();
					}
				}
		);
		ReflectionTestUtils.setField(
				reservationServiceTarget,
				"roomInventoryRepository",
				synchronizedRepository
		);
	}

	private InventoryState inventoryState(LocalDate inventoryDate) {
		return jdbcTemplate.queryForObject(
				"select total_quantity, reserved_quantity, version from room_inventories"
						+ " where room_id = ? and inventory_date = ?",
				(rowSet, rowNumber) -> new InventoryState(
						rowSet.getInt("total_quantity"),
						rowSet.getInt("reserved_quantity"),
						rowSet.getLong("version")
				),
				room.getId(),
				inventoryDate
		);
	}

	private int countConfirmedReservationsFor(LocalDate stayDate) {
		return jdbcTemplate.queryForObject(
				"select count(*) from reservations"
						+ " where room_id = ? and status = 'CONFIRMED'"
						+ " and check_in_date <= ? and check_out_date > ?",
				Integer.class,
				room.getId(),
				stayDate,
				stayDate
		);
	}

	private int reservedQuantity(LocalDate inventoryDate) {
		return jdbcTemplate.queryForObject(
				"select reserved_quantity from room_inventories"
						+ " where room_id = ? and inventory_date = ?",
				Integer.class,
				room.getId(),
				inventoryDate
		);
	}

	private CreateReservationRequest request(
			Long roomId,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return new CreateReservationRequest(
				roomId,
				1,
				checkInDate,
				checkOutDate,
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

	private record InventoryState(int totalQuantity, int reservedQuantity, long version) {

		private int availableQuantity() {
			return totalQuantity - reservedQuantity;
		}
	}
}
