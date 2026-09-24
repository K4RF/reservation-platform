package junsik.reservation.event.reservation.consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.repository.ProcessedReservationEventRepository;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@SpringBootTest(properties = {
		"reservation.kafka.enabled=true",
		"reservation.kafka.consumer.max-retries=2",
		"reservation.kafka.consumer.retry-backoff=10ms",
		"spring.kafka.consumer.group-id=reservation-platform-retry-dlt-integration-test",
		"spring.datasource.url=jdbc:h2:mem:reservation-event-retry-dlt;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@EmbeddedKafka(
		partitions = 3,
		topics = {"reservation.events.v1", "reservation.events.v1.dlt"},
		bootstrapServersProperty = "spring.kafka.bootstrap-servers"
)
@DirtiesContext
class ReservationEventRetryDltIntegrationTest {

	private static final String TOPIC = "reservation.events.v1";
	private static final String DLT_TOPIC = "reservation.events.v1.dlt";
	private static final String CONSUMER_GROUP = "reservation-platform-retry-dlt-integration-test";

	@Autowired
	private KafkaTemplate<Object, Object> kafkaTemplate;

	@Autowired
	private EmbeddedKafkaBroker embeddedKafkaBroker;

	@Autowired
	private ProcessedReservationEventRepository processedEventRepository;

	@MockitoBean
	private ReservationEventAuditLogService auditLogService;

	@BeforeEach
	void cleanUp() {
		processedEventRepository.deleteAll();
	}

	@Test
	void retriesATransientFailureAndProcessesTheEventBeforeExhaustion() throws Exception {
		ReservationCreatedEvent event = createdEvent(101L);
		doThrow(new TransientDataAccessResourceException("temporary database failure"))
				.doNothing()
				.when(auditLogService).recordCreated(event);

		send(event.partitionKey(), event);

		verify(auditLogService, timeout(10_000).times(2)).recordCreated(event);
		await(() -> processedEventRepository.existsByEventId(event.metadata().eventId()));
	}

	@Test
	void publishesAnExhaustedEventToDltAndContinuesWithTheNextEvent() throws Exception {
		ReservationCreatedEvent failedEvent = createdEvent(201L);
		ReservationCreatedEvent nextEvent = createdEvent(201L);
		doThrow(new TransientDataAccessResourceException("database remains unavailable"))
				.when(auditLogService).recordCreated(failedEvent);

		try (Consumer<String, ReservationEvent> dltConsumer = createDltConsumer()) {
			send(failedEvent.partitionKey(), failedEvent);

			ConsumerRecord<String, ReservationEvent> deadLetter = KafkaTestUtils.getSingleRecord(
					dltConsumer,
					DLT_TOPIC,
					Duration.ofSeconds(10)
			);

			verify(auditLogService, timeout(10_000).times(3)).recordCreated(failedEvent);
			assertThat(deadLetter.key()).isEqualTo(failedEvent.partitionKey());
			assertThat(deadLetter.value()).isEqualTo(failedEvent);
			assertHeader(deadLetter, KafkaHeaders.DLT_ORIGINAL_TOPIC, TOPIC);
			assertHeader(deadLetter, KafkaHeaders.DLT_ORIGINAL_CONSUMER_GROUP, CONSUMER_GROUP);
			assertThat(headerValue(deadLetter, KafkaHeaders.DLT_EXCEPTION_MESSAGE))
					.contains("database remains unavailable");
			assertThat(processedEventRepository.existsByEventId(failedEvent.metadata().eventId()))
					.isFalse();
		}

		send(nextEvent.partitionKey(), nextEvent);

		verify(auditLogService, timeout(10_000)).recordCreated(nextEvent);
		await(() -> processedEventRepository.existsByEventId(nextEvent.metadata().eventId()));
	}

	@Test
	void sendsANonRetryableContractFailureDirectlyToDlt() throws Exception {
		ReservationCreatedEvent event = createdEvent(301L);
		doThrow(new IllegalArgumentException("invalid event contract"))
				.when(auditLogService).recordCreated(event);

		try (Consumer<String, ReservationEvent> dltConsumer = createDltConsumer()) {
			send(event.partitionKey(), event);

			ConsumerRecord<String, ReservationEvent> deadLetter = KafkaTestUtils.getSingleRecord(
					dltConsumer,
					DLT_TOPIC,
					Duration.ofSeconds(10)
			);

			verify(auditLogService, timeout(10_000).times(1)).recordCreated(event);
			assertThat(deadLetter.value()).isEqualTo(event);
			assertThat(headerValue(deadLetter, KafkaHeaders.DLT_EXCEPTION_MESSAGE))
					.contains("invalid event contract");
		}
	}

	private Consumer<String, ReservationEvent> createDltConsumer() {
		Map<String, Object> consumerProperties = KafkaTestUtils.consumerProps(
				embeddedKafkaBroker,
				"reservation-dlt-verification-" + System.nanoTime(),
				false
		);
		JacksonJsonDeserializer<ReservationEvent> valueDeserializer =
				new JacksonJsonDeserializer<>(ReservationEvent.class, true);
		valueDeserializer.addTrustedPackages("junsik.reservation.event.reservation");
		Consumer<String, ReservationEvent> consumer = new DefaultKafkaConsumerFactory<>(
				consumerProperties,
				new StringDeserializer(),
				valueDeserializer
		).createConsumer();
		embeddedKafkaBroker.consumeFromAnEmbeddedTopic(consumer, true, DLT_TOPIC);
		return consumer;
	}

	private void send(String key, ReservationEvent event) throws Exception {
		kafkaTemplate.send(TOPIC, key, event).get(10, TimeUnit.SECONDS);
	}

	private void assertHeader(
			ConsumerRecord<String, ReservationEvent> record,
			String headerName,
			String expectedValue
	) {
		assertThat(headerValue(record, headerName)).isEqualTo(expectedValue);
	}

	private String headerValue(ConsumerRecord<String, ReservationEvent> record, String headerName) {
		Header header = record.headers().lastHeader(headerName);
		assertThat(header).as(headerName).isNotNull();
		return new String(header.value(), StandardCharsets.UTF_8);
	}

	private void await(BooleanSupplier condition) throws InterruptedException {
		long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
		while (!condition.getAsBoolean() && System.nanoTime() < deadline) {
			Thread.sleep(25);
		}
		assertThat(condition.getAsBoolean()).isTrue();
	}

	private ReservationCreatedEvent createdEvent(Long reservationId) {
		return ReservationCreatedEvent.create(
				reservationId,
				Instant.parse("2030-01-01T00:00:00Z"),
				new ReservationCreatedPayload(
						"RSV-20300101-" + String.format("%016X", reservationId),
						11L,
						21L,
						2,
						LocalDate.of(2030, 2, 1),
						LocalDate.of(2030, 2, 3),
						new BigDecimal("200000.00")
				)
		);
	}
}
