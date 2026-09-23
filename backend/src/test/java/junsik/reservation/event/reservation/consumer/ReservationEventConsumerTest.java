package junsik.reservation.event.reservation.consumer;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.event.reservation.handler.ReservationEventHandlerRegistry;

class ReservationEventConsumerTest {

	private final ReservationEventHandlerRegistry handlerRegistry =
			mock(ReservationEventHandlerRegistry.class);
	private final ReservationEventConsumer consumer =
			new ReservationEventConsumer(handlerRegistry);

	@Test
	void dispatchesAnEventWhoseKafkaKeyMatchesTheReservationId() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, event.partitionKey(), event);

		consumer.consume(record);

		verify(handlerRegistry).handle(event);
	}

	@Test
	void rejectsAnEventWhoseKafkaKeyDoesNotMatchTheReservationId() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, "999", event);

		assertThatIllegalArgumentException().isThrownBy(() -> consumer.consume(record));
		verify(handlerRegistry, never()).handle(event);
	}

	@Test
	void propagatesHandlerFailuresToTheKafkaListenerContainer() {
		ReservationCreatedEvent event = createdEvent();
		ConsumerRecord<String, junsik.reservation.event.reservation.ReservationEvent> record =
				new ConsumerRecord<>("reservation.events.v1", 0, 0L, event.partitionKey(), event);
		RuntimeException failure = new RuntimeException("post-processing failed");
		org.mockito.Mockito.doThrow(failure).when(handlerRegistry).handle(event);

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
