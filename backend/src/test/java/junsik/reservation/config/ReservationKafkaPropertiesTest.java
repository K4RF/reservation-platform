package junsik.reservation.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;

class ReservationKafkaPropertiesTest {

	@Test
	void acceptsReservationTopicSettings() {
		ReservationKafkaProperties properties = new ReservationKafkaProperties(
				true,
				" reservation.events.v1 ",
				3,
				(short) 1
		);

		assertThat(properties.enabled()).isTrue();
		assertThat(properties.reservationTopic()).isEqualTo("reservation.events.v1");
		assertThat(properties.partitions()).isEqualTo(3);
		assertThat(properties.replicationFactor()).isEqualTo((short) 1);
	}

	@Test
	void rejectsBlankTopicName() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationKafkaProperties(
				true,
				" ",
				3,
				(short) 1
		));
	}

	@Test
	void rejectsNonPositivePartitions() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationKafkaProperties(
				true,
				"reservation.events.v1",
				0,
				(short) 1
		));
	}

	@Test
	void rejectsNonPositiveReplicationFactor() {
		assertThatIllegalArgumentException().isThrownBy(() -> new ReservationKafkaProperties(
				true,
				"reservation.events.v1",
				3,
				(short) 0
		));
	}
}
