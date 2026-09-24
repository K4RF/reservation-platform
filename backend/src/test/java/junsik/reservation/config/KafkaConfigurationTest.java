package junsik.reservation.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

@SpringBootTest
class KafkaConfigurationTest {

	@Autowired
	private KafkaTemplate<?, ?> kafkaTemplate;

	@Autowired
	private ProducerFactory<?, ?> producerFactory;

	@Autowired
	private ConcurrentKafkaListenerContainerFactory<?, ?> kafkaListenerContainerFactory;

	@Autowired
	private Environment environment;

	@Test
	void separatesProducerAndConsumerConfigurationThroughSpringBootAutoConfiguration() {
		assertThat(kafkaTemplate).isNotNull();
		assertThat(producerFactory).isNotNull();
		assertThat(kafkaListenerContainerFactory).isNotNull();
		assertThat(environment.getProperty("spring.kafka.producer.acks")).isEqualTo("all");
		assertThat(environment.getProperty("spring.kafka.consumer.enable-auto-commit"))
				.isEqualTo("false");
		assertThat(environment.getProperty("spring.kafka.listener.ack-mode"))
				.isEqualTo("record");
	}

	@Test
	void declaresVersionedReservationLifecycleTopic() {
		ReservationKafkaProperties properties = new ReservationKafkaProperties(
				true,
				"reservation.events.v1",
				3,
				(short) 1
		);
		NewTopic topic = new KafkaTopicConfig().reservationEventsTopic(properties);

		assertThat(topic.name()).isEqualTo("reservation.events.v1");
		assertThat(topic.numPartitions()).isEqualTo(3);
		assertThat(topic.replicationFactor()).isEqualTo((short) 1);
	}

	@Test
	void declaresReservationDeadLetterTopicWithTheSourcePartitionCount() {
		ReservationKafkaProperties kafkaProperties = new ReservationKafkaProperties(
				true,
				"reservation.events.v1",
				3,
				(short) 1
		);
		ReservationKafkaConsumerProperties consumerProperties =
				new ReservationKafkaConsumerProperties(
						"reservation.events.v1.dlt",
						2,
						Duration.ofSeconds(1),
						Duration.ofSeconds(5)
				);

		NewTopic topic = new KafkaTopicConfig().reservationEventsDeadLetterTopic(
				kafkaProperties,
				consumerProperties
		);

		assertThat(topic.name()).isEqualTo("reservation.events.v1.dlt");
		assertThat(topic.numPartitions()).isEqualTo(3);
		assertThat(topic.replicationFactor()).isEqualTo((short) 1);
	}
}
