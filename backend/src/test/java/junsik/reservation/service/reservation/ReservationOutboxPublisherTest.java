package junsik.reservation.service.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.support.SendResult;

import junsik.reservation.config.ReservationOutboxProperties;
import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.event.reservation.KafkaReservationEventProducer;
import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.event.reservation.ReservationOutboxEventSerializer;
import junsik.reservation.repository.ReservationOutboxEventRepository;

class ReservationOutboxPublisherTest {

	private static final Instant PUBLISH_TIME = Instant.parse("2030-01-01T00:01:00Z");

	private ReservationOutboxEventRepository outboxEventRepository;
	private ReservationOutboxEventSerializer serializer;
	private KafkaReservationEventProducer producer;
	private ReservationOutboxPublisher publisher;
	private ReservationCreatedEvent event;
	private ReservationOutboxEvent outboxEvent;

	@BeforeEach
	void setUp() {
		outboxEventRepository = mock(ReservationOutboxEventRepository.class);
		serializer = mock(ReservationOutboxEventSerializer.class);
		producer = mock(KafkaReservationEventProducer.class);
		publisher = new ReservationOutboxPublisher(
				outboxEventRepository,
				serializer,
				producer,
				new ReservationOutboxProperties(
						true,
						false,
						Duration.ofSeconds(1),
						50,
						Duration.ofSeconds(5)
				),
				Clock.fixed(PUBLISH_TIME, ZoneOffset.UTC)
		);
		event = createdEvent();
		outboxEvent = ReservationOutboxEvent.create(event, "{\"event\":\"created\"}");
		given(outboxEventRepository.findBatchByStatusForUpdate(
				org.mockito.ArgumentMatchers.eq(ReservationOutboxStatus.PENDING),
				org.mockito.ArgumentMatchers.any(Pageable.class)
		)).willReturn(List.of(outboxEvent));
		given(serializer.deserialize(outboxEvent.getEventType(), outboxEvent.getPayload()))
				.willReturn(event);
	}

	@Test
	void marksAnEventPublishedOnlyAfterKafkaAcknowledgesIt() {
		SendResult<Object, Object> sendResult = successfulResult();
		given(producer.send(event)).willReturn(CompletableFuture.completedFuture(sendResult));

		int publishedCount = publisher.publishPendingBatch();

		assertThat(publishedCount).isOne();
		assertThat(outboxEvent.getStatus()).isEqualTo(ReservationOutboxStatus.PUBLISHED);
		assertThat(outboxEvent.getPublishedAt()).isEqualTo(PUBLISH_TIME);
		assertThat(outboxEvent.getPublishAttempts()).isOne();
		assertThat(outboxEvent.getLastError()).isNull();
	}

	@Test
	void keepsAFailedEventPendingSoTheNextBatchCanRetryIt() {
		CompletableFuture<SendResult<Object, Object>> failed = new CompletableFuture<>();
		failed.completeExceptionally(new IllegalStateException("broker unavailable"));
		given(producer.send(event)).willReturn(failed);

		int publishedCount = publisher.publishPendingBatch();

		assertThat(publishedCount).isZero();
		assertThat(outboxEvent.getStatus()).isEqualTo(ReservationOutboxStatus.PENDING);
		assertThat(outboxEvent.getPublishedAt()).isNull();
		assertThat(outboxEvent.getPublishAttempts()).isOne();
		assertThat(outboxEvent.getLastError()).contains("broker unavailable");
	}

	@Test
	void publishesAPendingEventOnALaterAttemptAfterTheBrokerRecovers() {
		CompletableFuture<SendResult<Object, Object>> failed = new CompletableFuture<>();
		failed.completeExceptionally(new IllegalStateException("broker unavailable"));
		given(producer.send(event))
				.willReturn(failed)
				.willReturn(CompletableFuture.completedFuture(successfulResult()));

		assertThat(publisher.publishPendingBatch()).isZero();
		assertThat(publisher.publishPendingBatch()).isOne();

		assertThat(outboxEvent.getStatus()).isEqualTo(ReservationOutboxStatus.PUBLISHED);
		assertThat(outboxEvent.getPublishAttempts()).isEqualTo(2);
		assertThat(outboxEvent.getLastError()).isNull();
	}

	@SuppressWarnings("unchecked")
	private SendResult<Object, Object> successfulResult() {
		SendResult<Object, Object> result = mock(SendResult.class);
		RecordMetadata metadata = mock(RecordMetadata.class);
		given(result.getRecordMetadata()).willReturn(metadata);
		given(metadata.topic()).willReturn("reservation.events.v1");
		given(metadata.partition()).willReturn(0);
		given(metadata.offset()).willReturn(1L);
		return result;
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
