package junsik.reservation.service.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import java.util.stream.IntStream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.support.MySqlRedisIntegrationTestSupport;

class ReservationConcurrencyStrategyComparisonIntegrationTest extends MySqlRedisIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(
			ReservationConcurrencyStrategyComparisonIntegrationTest.class
	);
	private static final int CONCURRENT_REQUESTS = 10;
	private static final int TOTAL_QUANTITY = 1;
	private static final long INVENTORY_ID = 1L;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PlatformTransactionManager transactionManager;

	@Autowired
	private ReservationCreationLock creationLock;

	private TransactionTemplate transactionTemplate;
	private ExecutorService executor;

	@BeforeEach
	void setUp() {
		transactionTemplate = new TransactionTemplate(transactionManager);
		executor = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
		createComparisonTables();
	}

	@AfterEach
	void tearDown() throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(10, TimeUnit.SECONDS);
	}

	@RepeatedTest(5)
	@Timeout(60)
	void comparesConcurrencyStrategiesWithTheSameInventoryAndRequestCount() throws Exception {
		ComparisonResult noLock = runNoLock();
		ComparisonResult pessimisticLock = runPessimisticLock();
		ComparisonResult optimisticLock = runOptimisticLock();
		ComparisonResult optimisticRetry = runOptimisticRetry();
		ComparisonResult redisLock = runRedisLock();

		assertThat(noLock.successCount()).isEqualTo(CONCURRENT_REQUESTS);
		assertThat(noLock.persistedReservationCount()).isEqualTo(CONCURRENT_REQUESTS);
		assertThat(noLock.oversold()).isTrue();

		assertConsistent(pessimisticLock);
		assertThat(pessimisticLock.failureCount(AttemptOutcome.INSUFFICIENT_QUANTITY))
				.isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);

		assertConsistent(optimisticLock);
		assertThat(optimisticLock.failureCount(AttemptOutcome.OPTIMISTIC_CONFLICT))
				.isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);

		assertConsistent(optimisticRetry);
		assertThat(optimisticRetry.failureCount(AttemptOutcome.INSUFFICIENT_QUANTITY))
				.isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);
		assertThat(optimisticRetry.retryCount()).isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);

		assertConsistent(redisLock);
		assertThat(redisLock.failureCount(AttemptOutcome.INSUFFICIENT_QUANTITY))
				.isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);
		assertThat(redisLock.lockFailureCount()).isZero();

		List.of(noLock, pessimisticLock, optimisticLock, optimisticRetry, redisLock)
				.forEach(result -> {
					assertThat(result.requestCount()).isEqualTo(CONCURRENT_REQUESTS);
					assertThat(result.totalQuantity()).isEqualTo(TOTAL_QUANTITY);
					assertThat(result.elapsed()).isPositive();
					log.info("Concurrency strategy comparison: {}", result);
				});
	}

	private ComparisonResult runNoLock() throws Exception {
		resetFixture();
		CyclicBarrier readBarrier = new CyclicBarrier(CONCURRENT_REQUESTS);
		return executeConcurrently(
				Strategy.NO_LOCK,
				() -> transactionTemplate.execute(status -> noLockAttempt(readBarrier)),
				new AtomicInteger()
		);
	}

	private ComparisonResult runPessimisticLock() throws Exception {
		resetFixture();
		return executeConcurrently(
				Strategy.PESSIMISTIC_LOCK,
				() -> transactionTemplate.execute(status -> pessimisticAttempt()),
				new AtomicInteger()
		);
	}

	private ComparisonResult runOptimisticLock() throws Exception {
		resetFixture();
		CyclicBarrier readBarrier = new CyclicBarrier(CONCURRENT_REQUESTS);
		return executeConcurrently(
				Strategy.OPTIMISTIC_LOCK,
				() -> transactionTemplate.execute(status -> optimisticAttempt(
						readBarrier,
						Strategy.OPTIMISTIC_LOCK
				)),
				new AtomicInteger()
		);
	}

	private ComparisonResult runOptimisticRetry() throws Exception {
		resetFixture();
		CyclicBarrier firstReadBarrier = new CyclicBarrier(CONCURRENT_REQUESTS);
		AtomicInteger retryCount = new AtomicInteger();
		return executeConcurrently(
				Strategy.OPTIMISTIC_LOCK_WITH_RETRY,
				() -> optimisticRetryAttempt(firstReadBarrier, retryCount),
				retryCount
		);
	}

	private ComparisonResult runRedisLock() throws Exception {
		resetFixture();
		return executeConcurrently(
				Strategy.REDIS_DISTRIBUTED_LOCK,
				this::redisLockAttempt,
				new AtomicInteger()
		);
	}

	private AttemptOutcome noLockAttempt(CyclicBarrier readBarrier) {
		InventoryState inventory = inventoryState(false);
		await(readBarrier);
		if (!inventory.available()) {
			return AttemptOutcome.INSUFFICIENT_QUANTITY;
		}
		jdbcTemplate.update(
				"update concurrency_strategy_inventory set reserved_quantity = ? where id = ?",
				inventory.reservedQuantity() + 1,
				INVENTORY_ID
		);
		insertReservation(Strategy.NO_LOCK);
		return AttemptOutcome.SUCCESS;
	}

	private AttemptOutcome pessimisticAttempt() {
		InventoryState inventory = inventoryState(true);
		if (!inventory.available()) {
			return AttemptOutcome.INSUFFICIENT_QUANTITY;
		}
		jdbcTemplate.update(
				"update concurrency_strategy_inventory"
						+ " set reserved_quantity = reserved_quantity + 1 where id = ?",
				INVENTORY_ID
		);
		insertReservation(Strategy.PESSIMISTIC_LOCK);
		return AttemptOutcome.SUCCESS;
	}

	private AttemptOutcome optimisticAttempt(CyclicBarrier readBarrier, Strategy strategy) {
		InventoryState inventory = inventoryState(false);
		if (readBarrier != null) {
			await(readBarrier);
		}
		if (!inventory.available()) {
			return AttemptOutcome.INSUFFICIENT_QUANTITY;
		}
		int updated = jdbcTemplate.update(
				"update concurrency_strategy_inventory"
						+ " set reserved_quantity = reserved_quantity + 1, version = version + 1"
						+ " where id = ? and version = ?",
				INVENTORY_ID,
				inventory.version()
		);
		if (updated == 0) {
			return AttemptOutcome.OPTIMISTIC_CONFLICT;
		}
		insertReservation(strategy);
		return AttemptOutcome.SUCCESS;
	}

	private AttemptOutcome optimisticRetryAttempt(
			CyclicBarrier firstReadBarrier,
			AtomicInteger retryCount
	) {
		for (int attempt = 1; attempt <= ReservationRetryService.MAX_ATTEMPTS; attempt++) {
			int currentAttempt = attempt;
			AttemptOutcome outcome = transactionTemplate.execute(status -> optimisticAttempt(
					currentAttempt == 1 ? firstReadBarrier : null,
					Strategy.OPTIMISTIC_LOCK_WITH_RETRY
			));
			if (outcome != AttemptOutcome.OPTIMISTIC_CONFLICT) {
				return outcome;
			}
			if (attempt < ReservationRetryService.MAX_ATTEMPTS) {
				retryCount.incrementAndGet();
			}
		}
		return AttemptOutcome.OPTIMISTIC_CONFLICT;
	}

	private AttemptOutcome redisLockAttempt() {
		try {
			return creationLock.execute(
					INVENTORY_ID,
					() -> transactionTemplate.execute(status -> guardedRedisAttempt())
			);
		} catch (BusinessException exception) {
			if (exception.getErrorCode() == RoomInventoryErrorCode.LOCK_ACQUISITION_FAILED
					|| exception.getErrorCode() == RoomInventoryErrorCode.LOCK_SERVICE_UNAVAILABLE) {
				return AttemptOutcome.LOCK_FAILURE;
			}
			throw exception;
		}
	}

	private AttemptOutcome guardedRedisAttempt() {
		InventoryState inventory = inventoryState(false);
		if (!inventory.available()) {
			return AttemptOutcome.INSUFFICIENT_QUANTITY;
		}
		jdbcTemplate.update(
				"update concurrency_strategy_inventory"
						+ " set reserved_quantity = reserved_quantity + 1 where id = ?",
				INVENTORY_ID
		);
		insertReservation(Strategy.REDIS_DISTRIBUTED_LOCK);
		return AttemptOutcome.SUCCESS;
	}

	private ComparisonResult executeConcurrently(
			Strategy strategy,
			Supplier<AttemptOutcome> operation,
			AtomicInteger retryCount
	) throws Exception {
		CountDownLatch ready = new CountDownLatch(CONCURRENT_REQUESTS);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<AttemptOutcome>> futures = IntStream.range(0, CONCURRENT_REQUESTS)
				.mapToObj(index -> executor.submit(() -> {
					ready.countDown();
					if (!start.await(10, TimeUnit.SECONDS)) {
						return AttemptOutcome.UNEXPECTED_FAILURE;
					}
					try {
						return operation.get();
					} catch (Throwable throwable) {
						log.error("Unexpected comparison attempt failure: strategy={}", strategy, throwable);
						return AttemptOutcome.UNEXPECTED_FAILURE;
					}
				}))
				.toList();

		assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
		long startedAt = System.nanoTime();
		start.countDown();
		List<AttemptOutcome> outcomes = futures.stream()
				.map(this::resultOf)
				.toList();
		Duration elapsed = Duration.ofNanos(System.nanoTime() - startedAt);

		Map<AttemptOutcome, Long> counts = new EnumMap<>(AttemptOutcome.class);
		outcomes.forEach(outcome -> counts.merge(outcome, 1L, Long::sum));
		InventoryState finalInventory = inventoryState(false);
		int persistedReservations = jdbcTemplate.queryForObject(
				"select count(*) from concurrency_strategy_reservations",
				Integer.class
		);

		return new ComparisonResult(
				strategy,
				CONCURRENT_REQUESTS,
				TOTAL_QUANTITY,
				counts,
				persistedReservations,
				finalInventory.reservedQuantity(),
				retryCount.get(),
				counts.getOrDefault(AttemptOutcome.LOCK_FAILURE, 0L).intValue(),
				persistedReservations > TOTAL_QUANTITY
						|| finalInventory.reservedQuantity() > TOTAL_QUANTITY,
				elapsed
		);
	}

	private AttemptOutcome resultOf(Future<AttemptOutcome> future) {
		try {
			return future.get(30, TimeUnit.SECONDS);
		} catch (Exception exception) {
			log.error("Failed to obtain comparison attempt result", exception);
			return AttemptOutcome.UNEXPECTED_FAILURE;
		}
	}

	private void assertConsistent(ComparisonResult result) {
		assertThat(result.successCount()).isEqualTo(TOTAL_QUANTITY);
		assertThat(result.failureCount()).isEqualTo(CONCURRENT_REQUESTS - TOTAL_QUANTITY);
		assertThat(result.persistedReservationCount()).isEqualTo(TOTAL_QUANTITY);
		assertThat(result.finalReservedQuantity()).isEqualTo(TOTAL_QUANTITY);
		assertThat(result.oversold()).isFalse();
		assertThat(result.failureCount(AttemptOutcome.UNEXPECTED_FAILURE)).isZero();
	}

	private InventoryState inventoryState(boolean forUpdate) {
		String sql = "select total_quantity, reserved_quantity, version"
				+ " from concurrency_strategy_inventory where id = ?"
				+ (forUpdate ? " for update" : "");
		return jdbcTemplate.queryForObject(
				sql,
				(row, rowNumber) -> new InventoryState(
						row.getInt("total_quantity"),
						row.getInt("reserved_quantity"),
						row.getLong("version")
				),
				INVENTORY_ID
		);
	}

	private void insertReservation(Strategy strategy) {
		jdbcTemplate.update(
				"insert into concurrency_strategy_reservations (strategy_name) values (?)",
				strategy.name()
		);
	}

	private void await(CyclicBarrier barrier) {
		try {
			barrier.await(10, TimeUnit.SECONDS);
		} catch (Exception exception) {
			throw new IllegalStateException("동시 재고 조회 Barrier 대기가 실패했습니다.", exception);
		}
	}

	private void createComparisonTables() {
		jdbcTemplate.execute("""
				create table if not exists concurrency_strategy_inventory (
				    id bigint primary key,
				    total_quantity int not null,
				    reserved_quantity int not null,
				    version bigint not null
				)
				""");
		jdbcTemplate.execute("""
				create table if not exists concurrency_strategy_reservations (
				    id bigint auto_increment primary key,
				    strategy_name varchar(40) not null
				)
				""");
	}

	private void resetFixture() {
		jdbcTemplate.update("delete from concurrency_strategy_reservations");
		jdbcTemplate.update("delete from concurrency_strategy_inventory");
		jdbcTemplate.update(
				"insert into concurrency_strategy_inventory"
						+ " (id, total_quantity, reserved_quantity, version) values (?, ?, 0, 0)",
				INVENTORY_ID,
				TOTAL_QUANTITY
		);
	}

	private enum Strategy {
		NO_LOCK,
		PESSIMISTIC_LOCK,
		OPTIMISTIC_LOCK,
		OPTIMISTIC_LOCK_WITH_RETRY,
		REDIS_DISTRIBUTED_LOCK
	}

	private enum AttemptOutcome {
		SUCCESS,
		INSUFFICIENT_QUANTITY,
		OPTIMISTIC_CONFLICT,
		LOCK_FAILURE,
		UNEXPECTED_FAILURE
	}

	private record InventoryState(int totalQuantity, int reservedQuantity, long version) {

		private boolean available() {
			return reservedQuantity < totalQuantity;
		}
	}

	private record ComparisonResult(
			Strategy strategy,
			int requestCount,
			int totalQuantity,
			Map<AttemptOutcome, Long> outcomes,
			int persistedReservationCount,
			int finalReservedQuantity,
			int retryCount,
			int lockFailureCount,
			boolean oversold,
			Duration elapsed
	) {

		private long successCount() {
			return outcomes.getOrDefault(AttemptOutcome.SUCCESS, 0L);
		}

		private long failureCount() {
			return requestCount - successCount();
		}

		private long failureCount(AttemptOutcome outcome) {
			return outcomes.getOrDefault(outcome, 0L);
		}
	}
}
