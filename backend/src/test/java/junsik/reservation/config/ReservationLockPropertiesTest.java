package junsik.reservation.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;

import org.junit.jupiter.api.Test;

class ReservationLockPropertiesTest {

	@Test
	void acceptsPositiveWaitAndLeaseDurations() {
		ReservationLockProperties properties = new ReservationLockProperties(
				Duration.ofSeconds(3),
				Duration.ofSeconds(30)
		);

		assertThat(properties.waitTime()).isEqualTo(Duration.ofSeconds(3));
		assertThat(properties.leaseTime()).isEqualTo(Duration.ofSeconds(30));
	}

	@Test
	void rejectsNonPositiveWaitTime() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationLockProperties(
				Duration.ZERO,
				Duration.ofSeconds(30)
		));
	}

	@Test
	void rejectsNonPositiveLeaseTime() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationLockProperties(
				Duration.ofSeconds(3),
				Duration.ofSeconds(-1)
		));
	}

	@Test
	void rejectsPositiveDurationThatIsShorterThanOneMillisecond() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationLockProperties(
				Duration.ofNanos(1),
				Duration.ofSeconds(30)
		));
	}
}
