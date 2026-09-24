package junsik.reservation.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;

import org.junit.jupiter.api.Test;

class ReservationKafkaConsumerPropertiesTest {

	@Test
	void acceptsRetryAndDeadLetterSettings() {
		ReservationKafkaConsumerProperties properties = new ReservationKafkaConsumerProperties(
				" reservation.events.v1.dlt ",
				2,
				Duration.ofSeconds(1),
				Duration.ofSeconds(5)
		);

		assertThat(properties.deadLetterTopic()).isEqualTo("reservation.events.v1.dlt");
		assertThat(properties.maxRetries()).isEqualTo(2);
		assertThat(properties.retryBackoff()).isEqualTo(Duration.ofSeconds(1));
		assertThat(properties.deadLetterPublishTimeout()).isEqualTo(Duration.ofSeconds(5));
	}

	@Test
	void rejectsBlankDeadLetterTopic() {
		assertThatIllegalArgumentException().isThrownBy(() -> properties(" ", 2, Duration.ofSeconds(1)));
	}

	@Test
	void rejectsNegativeRetryCount() {
		assertThatIllegalArgumentException().isThrownBy(() -> properties("reservation.events.v1.dlt", -1,
				Duration.ofSeconds(1)));
	}

	@Test
	void rejectsNegativeBackoff() {
		assertThatIllegalArgumentException().isThrownBy(() -> properties("reservation.events.v1.dlt", 2,
				Duration.ofMillis(-1)));
	}

	@Test
	void rejectsNonPositiveDeadLetterPublishTimeout() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationKafkaConsumerProperties(
				"reservation.events.v1.dlt",
				2,
				Duration.ofSeconds(1),
				Duration.ZERO
		));
	}

	private ReservationKafkaConsumerProperties properties(
			String deadLetterTopic,
			int maxRetries,
			Duration retryBackoff
	) {
		return new ReservationKafkaConsumerProperties(
				deadLetterTopic,
				maxRetries,
				retryBackoff,
				Duration.ofSeconds(5)
		);
	}
}
