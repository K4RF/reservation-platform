package junsik.reservation.event.reservation.consumer;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.service.reservation.ReservationEventIdempotencyService;
import junsik.reservation.service.reservation.ReservationEventProcessingResult;

class ReservationEventConsumerTest {

	private final ReservationEventIdempotencyService idempotencyService =
			mock(ReservationEventIdempotencyService.class);
	private final ReservationEventConsumer consumer =
			new ReservationEventConsumer(idempotencyService);

	@Test
	void dispatchesAnEventWhoseKafkaKeyMatchesTheReservationId() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, event.partitionKey(), event);
		when(idempotencyService.process(event)).thenReturn(ReservationEventProcessingResult.PROCESSED);

		consumer.consume(record);

		verify(idempotencyService).process(event);
	}

	@Test
	void acknowledgesAnAlreadyProcessedDuplicateWithoutDispatchingAgain() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 1L, event.partitionKey(), event);
		when(idempotencyService.process(event)).thenReturn(ReservationEventProcessingResult.DUPLICATE);

		consumer.consume(record);

		verify(idempotencyService).process(event);
	}

	@Test
	void rejectsAnEventWhoseKafkaKeyDoesNotMatchTheReservationId() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, "999", event);

		assertThatIllegalArgumentException().isThrownBy(() -> consumer.consume(record));
		verify(idempotencyService, never()).process(event);
	}

	@Test
	void propagatesHandlerFailuresToTheKafkaListenerContainer() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, event.partitionKey(), event);
		RuntimeException failure = new RuntimeException("post-processing failed");
		doThrow(failure).when(idempotencyService).process(event);

		assertThatThrownBy(() -> consumer.consume(record)).isSameAs(failure);
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
