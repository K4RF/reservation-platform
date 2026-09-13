package junsik.reservation.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservation.distributed-lock")
public record ReservationLockProperties(
		Duration waitTime,
		Duration leaseTime
) {

	public ReservationLockProperties {
		validatePositive(waitTime, "wait-time");
		validatePositive(leaseTime, "lease-time");
	}

	private static void validatePositive(Duration duration, String propertyName) {
		if (duration == null || duration.toMillis() <= 0) {
			throw new IllegalArgumentException(
					"reservation.distributed-lock." + propertyName + " must be positive"
			);
		}
	}
}
