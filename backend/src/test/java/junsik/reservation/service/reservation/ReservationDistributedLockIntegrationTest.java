package junsik.reservation.service.reservation;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import junsik.reservation.config.ReservationLockProperties;
import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.member.Member;
import junsik.reservation.entity.room.Room;
import junsik.reservation.entity.room.RoomInventory;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlRedisIntegrationTestSupport;

class ReservationDistributedLockIntegrationTest extends MySqlRedisIntegrationTestSupport {

	private static final int CONCURRENT_REQUESTS = 10;
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2036, 3, 10);
	private static final LocalDate CHECK_OUT_DATE = CHECK_IN_DATE.plusDays(1);

	@Autowired
	private RedisReservationCreationLock creationLock;

	@Autowired
	private ReservationRetryService reservationRetryService;

	@Autowired
	private ReservationCreationCoordinator reservationCreationCoordinator;

	@Autowired
	private RedissonClient redissonClient;

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
	private Member member;
	private Room room;

	@BeforeEach
	void setUp() {
		String fixtureId = UUID.randomUUID().toString();
		Accommodation accommodation = accommodationRepository.saveAndFlush(
				accommodation("Distributed Lock " + fixtureId)
		);
		room = roomRepository.saveAndFlush(room(accommodation));
		member = memberRepository.saveAndFlush(member("distributed-lock-" + fixtureId + "@example.com"));
		roomInventoryRepository.saveAndFlush(RoomInventory.create(room, CHECK_IN_DATE, 1));
		executor = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
	}

	@AfterEach
	void tearDown() throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(10, TimeUnit.SECONDS);
	}

	@Test
	@Timeout(30)
	void serializesConcurrentReservationsForTheSameRoom() throws Exception {
		BlockingReservationCreator blockingRetryService = new BlockingReservationCreator(
				reservationRetryService
		);
		ReservationCreationCoordinator creationCoordinator = new ReservationCreationCoordinator(
				creationLock,
				blockingRetryService
		);
		CreateReservationRequest request = request(room.getId());

		Future<ReservationAttempt> first = executor.submit(() -> attempt(
				() -> creationCoordinator.create(member.getId(), request)
		));
		assertThat(blockingRetryService.firstAttemptEntered.await(10, TimeUnit.SECONDS)).isTrue();
		Future<ReservationAttempt> second = executor.submit(() -> attempt(
				() -> creationCoordinator.create(member.getId(), request)
		));

		assertThat(blockingRetryService.secondAttemptEntered.await(300, TimeUnit.MILLISECONDS)).isFalse();
		blockingRetryService.releaseFirstAttempt.countDown();
		List<ReservationAttempt> attempts = List.of(first.get(), second.get());

		assertThat(attempts).filteredOn(ReservationAttempt::succeeded).hasSize(1);
		assertThat(attempts)
				.filteredOn(attempt -> !attempt.succeeded())
				.singleElement()
				.satisfies(attempt -> {
					assertThat(attempt.failure()).isInstanceOf(BusinessException.class);
					assertThat(((BusinessException) attempt.failure()).getErrorCode())
							.isEqualTo(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
				});
		assertThat(blockingRetryService.secondAttemptEntered.getCount()).isZero();
		assertThat(confirmedReservationCount()).isOne();
		assertThat(reservedQuantity()).isOne();
		assertThat(redissonClient.getLock(creationLock.keyFor(room.getId())).isLocked()).isFalse();
	}

	@Test
	@Timeout(30)
	void keepsMultiNightInventoryConsistentWhenTenRequestsCompeteForOneRoom() throws Exception {
		List<LocalDate> stayDates = CHECK_IN_DATE.datesUntil(CHECK_IN_DATE.plusDays(3)).toList();
		roomInventoryRepository.saveAllAndFlush(
				stayDates.stream()
						.skip(1)
						.map(date -> RoomInventory.create(room, date, 1))
						.toList()
		);
		CreateReservationRequest request = request(
				room.getId(),
				CHECK_IN_DATE,
				CHECK_IN_DATE.plusDays(3)
		);
		CountDownLatch ready = new CountDownLatch(CONCURRENT_REQUESTS);
		CountDownLatch start = new CountDownLatch(1);

		List<Future<ReservationAttempt>> futures = IntStream.range(0, CONCURRENT_REQUESTS)
				.mapToObj(index -> executor.submit(() -> {
					ready.countDown();
					if (!start.await(10, TimeUnit.SECONDS)) {
						return ReservationAttempt.failed(
								new IllegalStateException("동시 예약 시작 대기 시간이 초과되었습니다.")
						);
					}
					return attempt(() -> reservationCreationCoordinator.create(member.getId(), request));
				}))
				.toList();

		assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
		start.countDown();
		List<ReservationAttempt> attempts = futures.stream()
				.map(this::resultOf)
				.toList();

		assertThat(attempts).filteredOn(ReservationAttempt::succeeded).hasSize(1);
		assertThat(attempts)
				.filteredOn(attempt -> !attempt.succeeded())
				.hasSize(CONCURRENT_REQUESTS - 1)
				.allSatisfy(attempt -> {
					assertThat(attempt.failure()).isInstanceOf(BusinessException.class);
					assertThat(((BusinessException) attempt.failure()).getErrorCode())
							.isEqualTo(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
				});
		assertThat(confirmedReservationCount(room.getId())).isOne();
		stayDates.forEach(date -> assertThat(reservedQuantity(room.getId(), date)).isOne());
		assertThat(redissonClient.getLock(creationLock.keyFor(room.getId())).isLocked()).isFalse();
	}

	@Test
	@Timeout(30)
	void usesIndependentLocksForDifferentRooms() throws Exception {
		Room otherRoom = roomRepository.saveAndFlush(
				room(room.getAccommodation(), "Parallel Room", 2, "100000.00")
		);
		roomInventoryRepository.saveAndFlush(RoomInventory.create(otherRoom, CHECK_IN_DATE, 1));
		CyclicBarrier bothRoomsEntered = new CyclicBarrier(2);
		ReservationCreator parallelRoomCreator = (memberId, request) -> {
			await(bothRoomsEntered);
			return reservationRetryService.create(memberId, request);
		};
		ReservationCreationCoordinator coordinator = new ReservationCreationCoordinator(
				creationLock,
				parallelRoomCreator
		);

		Future<ReservationAttempt> firstRoom = executor.submit(() -> attempt(
				() -> coordinator.create(member.getId(), request(room.getId()))
		));
		Future<ReservationAttempt> secondRoom = executor.submit(() -> attempt(
				() -> coordinator.create(member.getId(), request(otherRoom.getId()))
		));
		List<ReservationAttempt> attempts = List.of(firstRoom.get(), secondRoom.get());

		assertThat(attempts).allMatch(ReservationAttempt::succeeded);
		assertThat(confirmedReservationCount(room.getId())).isOne();
		assertThat(confirmedReservationCount(otherRoom.getId())).isOne();
		assertThat(reservedQuantity(room.getId(), CHECK_IN_DATE)).isOne();
		assertThat(reservedQuantity(otherRoom.getId(), CHECK_IN_DATE)).isOne();
	}

	@Test
	void releasesLockWhenReservationTransactionFails() {
		Long missingRoomId = Long.MAX_VALUE;
		ReservationCreationCoordinator creationCoordinator = new ReservationCreationCoordinator(
				creationLock,
				reservationRetryService
		);

		assertThatThrownBy(() -> creationCoordinator.create(member.getId(), request(missingRoomId)))
				.isInstanceOf(BusinessException.class)
				.satisfies(exception -> assertThat(((BusinessException) exception).getErrorCode())
						.isEqualTo(RoomErrorCode.NOT_FOUND));
		assertThat(redissonClient.getLock(creationLock.keyFor(missingRoomId)).isLocked()).isFalse();
	}

	@Test
	@Timeout(10)
	void rejectsRequestWhenAnotherOwnerExceedsWaitTime() throws Exception {
		RedisReservationCreationLock timeoutLock = new RedisReservationCreationLock(
				redissonClient,
				new ReservationLockProperties(Duration.ofMillis(200), Duration.ofSeconds(5))
		);
		RLock competingLock = redissonClient.getLock(timeoutLock.keyFor(room.getId()));
		CountDownLatch ownerAcquired = new CountDownLatch(1);
		CountDownLatch releaseOwner = new CountDownLatch(1);
		AtomicInteger operationInvocations = new AtomicInteger();

		Future<?> owner = executor.submit(() -> {
			competingLock.lock(5, TimeUnit.SECONDS);
			ownerAcquired.countDown();
			try {
				if (!releaseOwner.await(5, TimeUnit.SECONDS)) {
					throw new IllegalStateException("분산 락 소유자 해제 대기 시간이 초과되었습니다.");
				}
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("분산 락 소유자 대기가 중단되었습니다.", exception);
			} finally {
				if (competingLock.isHeldByCurrentThread()) {
					competingLock.unlock();
				}
			}
		});

		assertThat(ownerAcquired.await(5, TimeUnit.SECONDS)).isTrue();
		try {
			assertThatThrownBy(() -> timeoutLock.execute(room.getId(), () -> {
				operationInvocations.incrementAndGet();
				return "not executed";
			}))
					.isInstanceOf(BusinessException.class)
					.satisfies(exception -> assertThat(((BusinessException) exception).getErrorCode())
							.isEqualTo(RoomInventoryErrorCode.LOCK_ACQUISITION_FAILED));
		} finally {
			releaseOwner.countDown();
		}

		owner.get(5, TimeUnit.SECONDS);
		assertThat(operationInvocations).hasValue(0);
		assertThat(competingLock.isLocked()).isFalse();
	}

	@Test
	@Timeout(10)
	void fixedLeaseReleasesLockWhenOwnerDoesNotUnlock() throws Exception {
		Duration leaseTime = Duration.ofMillis(300);
		RedisReservationCreationLock leaseLock = new RedisReservationCreationLock(
				redissonClient,
				new ReservationLockProperties(Duration.ofSeconds(2), leaseTime)
		);
		RLock abandonedLock = redissonClient.getLock(leaseLock.keyFor(room.getId()));
		CountDownLatch ownerAcquired = new CountDownLatch(1);

		Future<?> owner = executor.submit(() -> {
			abandonedLock.lock(leaseTime.toMillis(), TimeUnit.MILLISECONDS);
			ownerAcquired.countDown();
		});

		assertThat(ownerAcquired.await(5, TimeUnit.SECONDS)).isTrue();
		owner.get(5, TimeUnit.SECONDS);

		assertThat(leaseLock.execute(room.getId(), () -> "completed"))
				.isEqualTo("completed");
		assertThat(abandonedLock.isLocked()).isFalse();
	}

	private ReservationAttempt attempt(Runnable operation) {
		try {
			operation.run();
			return ReservationAttempt.success();
		} catch (Throwable throwable) {
			return ReservationAttempt.failed(throwable);
		}
	}

	private ReservationAttempt resultOf(Future<ReservationAttempt> future) {
		try {
			return future.get(20, TimeUnit.SECONDS);
		} catch (Exception exception) {
			return ReservationAttempt.failed(exception);
		}
	}

	private void await(CyclicBarrier barrier) {
		try {
			barrier.await(10, TimeUnit.SECONDS);
		} catch (Exception exception) {
			throw new IllegalStateException("객실별 Lock 진입 대기가 실패했습니다.", exception);
		}
	}

	private int confirmedReservationCount() {
		return confirmedReservationCount(room.getId());
	}

	private int confirmedReservationCount(Long roomId) {
		return jdbcTemplate.queryForObject(
				"select count(*) from reservations where room_id = ? and status = 'CONFIRMED'",
				Integer.class,
				roomId
		);
	}

	private int reservedQuantity() {
		return reservedQuantity(room.getId(), CHECK_IN_DATE);
	}

	private int reservedQuantity(Long roomId, LocalDate inventoryDate) {
		return jdbcTemplate.queryForObject(
				"select reserved_quantity from room_inventories where room_id = ? and inventory_date = ?",
				Integer.class,
				roomId,
				inventoryDate
		);
	}

	private CreateReservationRequest request(Long roomId) {
		return request(roomId, CHECK_IN_DATE, CHECK_OUT_DATE);
	}

	private CreateReservationRequest request(Long roomId, LocalDate checkInDate, LocalDate checkOutDate) {
		return new CreateReservationRequest(
				roomId,
				1,
				checkInDate,
				checkOutDate,
				new RepresentativeGuestRequest(
						"Distributed Lock Guest",
						"distributed-lock-guest@example.com",
						"010-1234-5678"
				)
		);
	}

	private static class BlockingReservationCreator implements ReservationCreator {

		private final ReservationRetryService delegate;
		private final AtomicInteger attempts = new AtomicInteger();
		private final CountDownLatch firstAttemptEntered = new CountDownLatch(1);
		private final CountDownLatch secondAttemptEntered = new CountDownLatch(1);
		private final CountDownLatch releaseFirstAttempt = new CountDownLatch(1);

		private BlockingReservationCreator(ReservationRetryService delegate) {
			this.delegate = delegate;
		}

		@Override
		public junsik.reservation.dto.reservation.response.ReservationResponse create(
				Long memberId,
				CreateReservationRequest request
		) {
			int attempt = attempts.incrementAndGet();
			if (attempt == 1) {
				firstAttemptEntered.countDown();
				awaitRelease();
			} else {
				secondAttemptEntered.countDown();
			}
			return delegate.create(memberId, request);
		}

		private void awaitRelease() {
			try {
				if (!releaseFirstAttempt.await(10, TimeUnit.SECONDS)) {
					throw new IllegalStateException("분산 락 테스트의 첫 번째 요청 해제 대기 시간이 초과되었습니다.");
				}
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("분산 락 테스트 대기가 중단되었습니다.", exception);
			}
		}
	}

	private record ReservationAttempt(boolean succeeded, Throwable failure) {

		private static ReservationAttempt success() {
			return new ReservationAttempt(true, null);
		}

		private static ReservationAttempt failed(Throwable failure) {
			return new ReservationAttempt(false, failure);
		}
	}
}
