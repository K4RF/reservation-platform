package junsik.reservation.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.cache")
public record ReservationCacheProperties(Duration detailTtl) {

	public ReservationCacheProperties {
		if (detailTtl == null || detailTtl.isZero() || detailTtl.isNegative()) {
			throw new IllegalArgumentException("reservation.cache.detail-ttl must be positive");
		}
	}
}
