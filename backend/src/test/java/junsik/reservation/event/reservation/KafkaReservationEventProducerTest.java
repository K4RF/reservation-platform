package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import junsik.reservation.config.ReservationKafkaProperties;

class KafkaReservationEventProducerTest {

	private KafkaTemplate<Object, Object> kafkaTemplate;
	private KafkaReservationEventProducer producer;

	@BeforeEach
	@SuppressWarnings("unchecked")
	void setUp() {
		kafkaTemplate = mock(KafkaTemplate.class);
		producer = new KafkaReservationEventProducer(
				kafkaTemplate,
				new ReservationKafkaProperties(true, "reservation.events.v1", 3, (short) 1)
		);
	}

	@Test
	void routesEventWithReservationIdKeyAndHandlesSuccessfulResult() {
		ReservationCreatedEvent event = createdEvent();
		CompletableFuture<SendResult<Object, Object>> future = new CompletableFuture<>();
		SendResult<Object, Object> sendResult = mock();
		RecordMetadata metadata = mock();
		given(kafkaTemplate.send("reservation.events.v1", "101", event)).willReturn(future);
		given(sendResult.getRecordMetadata()).willReturn(metadata);
		given(metadata.topic()).willReturn("reservation.events.v1");
		given(metadata.partition()).willReturn(2);
		given(metadata.offset()).willReturn(42L);

		producer.publishAfterCommit(event);
		future.complete(sendResult);

		then(kafkaTemplate).should().send("reservation.events.v1", "101", event);
	}

	@Test
	void recordsAsynchronousSendFailureWithoutThrowingAfterDatabaseCommit() {
		ReservationCreatedEvent event = createdEvent();
		CompletableFuture<SendResult<Object, Object>> future = new CompletableFuture<>();
		given(kafkaTemplate.send("reservation.events.v1", "101", event)).willReturn(future);

		producer.publishAfterCommit(event);

		assertThatNoException().isThrownBy(
				() -> future.completeExceptionally(new IllegalStateException("broker unavailable"))
		);
	}

	@Test
	void recordsSynchronousSendFailureWithoutReportingCommittedReservationAsFailed() {
		ReservationCreatedEvent event = createdEvent();
		given(kafkaTemplate.send("reservation.events.v1", "101", event))
				.willThrow(new IllegalStateException("metadata unavailable"));

		assertThatNoException().isThrownBy(() -> producer.publishAfterCommit(event));
	}

	private ReservationCreatedEvent createdEvent() {
		return ReservationCreatedEvent.create(
				101L,
				Instant.parse("2030-01-01T00:00:00Z"),
				new ReservationCreatedPayload(
						"RSV-20300101-0000000000000001",
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
