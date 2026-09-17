package junsik.reservation.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.cache")
public record ReservationCacheProperties(
		Duration detailTtl,
		Duration missLockRetryInterval,
		Duration missLockTtl
) {

	public ReservationCacheProperties {
		if (detailTtl == null || detailTtl.isZero() || detailTtl.isNegative()) {
			throw new IllegalArgumentException("reservation.cache.detail-ttl must be positive");
		}
		if (missLockRetryInterval == null
				|| missLockRetryInterval.isZero()
				|| missLockRetryInterval.isNegative()) {
			throw new IllegalArgumentException(
					"reservation.cache.miss-lock-retry-interval must be positive"
			);
		}
		if (missLockTtl == null || missLockTtl.isZero() || missLockTtl.isNegative()) {
			throw new IllegalArgumentException("reservation.cache.miss-lock-ttl must be positive");
		}
	}
}
