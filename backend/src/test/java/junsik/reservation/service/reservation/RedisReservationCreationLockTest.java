package junsik.reservation.service.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.redisson.client.RedisException;

import junsik.reservation.config.ReservationLockProperties;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;

@ExtendWith(MockitoExtension.class)
class RedisReservationCreationLockTest {

	private static final Long ROOM_ID = 7L;
	private static final long WAIT_MILLIS = 3_000L;
	private static final long LEASE_MILLIS = 30_000L;

	@Mock
	private RedissonClient redissonClient;

	@Mock
	private RLock lock;

	private RedisReservationCreationLock creationLock;

	@BeforeEach
	void setUp() {
		ReservationLockProperties properties = new ReservationLockProperties(
				Duration.ofMillis(WAIT_MILLIS),
				Duration.ofSeconds(30)
		);
		creationLock = new RedisReservationCreationLock(redissonClient, properties);
		when(redissonClient.getLock("reservation:lock:room:{7}")).thenReturn(lock);
	}

	@AfterEach
	void clearInterruptedFlag() {
		Thread.interrupted();
	}

	@Test
	void executesOperationAndUnlocksOwnedLock() throws InterruptedException {
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenReturn(true);
		when(lock.isHeldByCurrentThread()).thenReturn(true);

		String result = creationLock.execute(ROOM_ID, () -> "completed");

		assertThat(result).isEqualTo("completed");
		verify(lock).unlock();
	}

	@Test
	void unlocksOwnedLockWhenOperationFails() throws InterruptedException {
		IllegalStateException failure = new IllegalStateException("reservation failed");
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenReturn(true);
		when(lock.isHeldByCurrentThread()).thenReturn(true);

		assertThatThrownBy(() -> creationLock.execute(ROOM_ID, () -> {
			throw failure;
		})).isSameAs(failure);
		verify(lock).unlock();
	}

	@Test
	void doesNotUnlockWhenCurrentThreadLostOwnership() throws InterruptedException {
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenReturn(true);
		when(lock.isHeldByCurrentThread()).thenReturn(false);

		assertThat(creationLock.execute(ROOM_ID, () -> "completed"))
				.isEqualTo("completed");
		verify(lock, never()).unlock();
	}

	@Test
	void rejectsRequestWhenLockWaitTimeExpires() throws InterruptedException {
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenReturn(false);

		assertLockAcquisitionFailure();
		verify(lock, never()).unlock();
	}

	@Test
	void restoresInterruptedFlagAndRejectsRequest() throws InterruptedException {
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS))
				.thenThrow(new InterruptedException());

		assertLockAcquisitionFailure();
		assertThat(Thread.currentThread().isInterrupted()).isTrue();
		verify(lock, never()).unlock();
	}

	@Test
	void rejectsRequestWhenRedisFailsDuringAcquisition() throws InterruptedException {
		RedisException failure = new RedisException("redis unavailable");
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenThrow(failure);

		assertLockServiceUnavailable(failure);
		verify(lock, never()).unlock();
	}

	@Test
	void rejectsRequestWhenRedisFailsDuringRelease() throws InterruptedException {
		RedisException failure = new RedisException("redis unavailable");
		when(lock.tryLock(WAIT_MILLIS, LEASE_MILLIS, TimeUnit.MILLISECONDS)).thenReturn(true);
		when(lock.isHeldByCurrentThread()).thenThrow(failure);

		assertLockServiceUnavailable(failure);
		verify(lock, never()).unlock();
	}

	private void assertLockAcquisitionFailure() {
		assertThatThrownBy(() -> creationLock.execute(ROOM_ID, () -> "not executed"))
				.isInstanceOf(BusinessException.class)
				.satisfies(exception -> assertThat(((BusinessException) exception).getErrorCode())
						.isEqualTo(RoomInventoryErrorCode.LOCK_ACQUISITION_FAILED));
	}

	private void assertLockServiceUnavailable(RedisException cause) {
		assertThatThrownBy(() -> creationLock.execute(ROOM_ID, () -> "not executed"))
				.isInstanceOf(BusinessException.class)
				.hasCause(cause)
				.satisfies(exception -> assertThat(((BusinessException) exception).getErrorCode())
						.isEqualTo(RoomInventoryErrorCode.LOCK_SERVICE_UNAVAILABLE));
	}
}
