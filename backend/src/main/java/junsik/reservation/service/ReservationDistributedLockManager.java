package junsik.reservation.service;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

import junsik.reservation.config.ReservationLockProperties;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Component
public class ReservationDistributedLockManager {

	private static final String KEY_PREFIX = "reservation:lock:room:";

	private final RedissonClient redissonClient;
	private final ReservationLockProperties properties;

	public ReservationDistributedLockManager(
			RedissonClient redissonClient,
			ReservationLockProperties properties
	) {
		this.redissonClient = redissonClient;
		this.properties = properties;
	}

	public <T> T executeWithLock(Long roomId, Supplier<T> operation) {
		RLock lock = redissonClient.getLock(keyFor(roomId));
		boolean acquired = false;
		try {
			acquired = lock.tryLock(properties.waitTime().toMillis(), TimeUnit.MILLISECONDS);
			if (!acquired) {
				throw new BusinessException(RoomInventoryErrorCode.LOCK_ACQUISITION_FAILED);
			}
			return operation.get();
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new BusinessException(RoomInventoryErrorCode.LOCK_ACQUISITION_FAILED);
		} finally {
			if (acquired && lock.isHeldByCurrentThread()) {
				lock.unlock();
			}
		}
	}

	String keyFor(Long roomId) {
		return KEY_PREFIX + "{" + roomId + "}";
	}
}
