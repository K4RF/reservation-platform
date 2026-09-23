package junsik.reservation.event.reservation.handler;

import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import junsik.reservation.event.reservation.ReservationChangedEvent;
import junsik.reservation.event.reservation.ReservationChangedPayload;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;

class ReservationEventHandlerRegistryTest {

	@Test
	void dispatchesAnEventToTheHandlerRegisteredForItsEventType() {
		ReservationEventHandler createdHandler = handler(ReservationEventType.RESERVATION_CREATED);
		ReservationEventHandler changedHandler = handler(ReservationEventType.RESERVATION_CHANGED);
		ReservationEventHandler cancelledHandler = handler(ReservationEventType.RESERVATION_CANCELLED);
		ReservationEventHandlerRegistry registry = new ReservationEventHandlerRegistry(
				List.of(createdHandler, changedHandler, cancelledHandler)
		);
		ReservationEvent event = ReservationChangedEvent.create(
				101L,
				Instant.parse("2030-01-01T00:00:00Z"),
				new ReservationChangedPayload(
						"RSV-20300101-0000000000000001",
						11L,
						21L,
						LocalDate.of(2030, 2, 1),
						LocalDate.of(2030, 2, 3),
						LocalDate.of(2030, 2, 2),
						LocalDate.of(2030, 2, 4),
						new BigDecimal("220000.00")
				)
		);

		registry.handle(event);

		verify(changedHandler).handle(event);
	}

	@Test
	void failsFastWhenAnEventTypeHasNoHandler() {
		List<ReservationEventHandler> incompleteHandlers = List.of(
				handler(ReservationEventType.RESERVATION_CREATED),
				handler(ReservationEventType.RESERVATION_CHANGED)
		);

		assertThatIllegalStateException()
				.isThrownBy(() -> new ReservationEventHandlerRegistry(incompleteHandlers))
				.withMessageContaining("Missing Reservation Event handler");
	}

	@Test
	void failsFastWhenAnEventTypeHasDuplicateHandlers() {
		List<ReservationEventHandler> duplicateHandlers = List.of(
				handler(ReservationEventType.RESERVATION_CREATED),
				handler(ReservationEventType.RESERVATION_CREATED),
				handler(ReservationEventType.RESERVATION_CHANGED),
				handler(ReservationEventType.RESERVATION_CANCELLED)
		);

		assertThatIllegalStateException()
				.isThrownBy(() -> new ReservationEventHandlerRegistry(duplicateHandlers))
				.withMessageContaining("Duplicate Reservation Event handler");
	}

	private ReservationEventHandler handler(ReservationEventType eventType) {
		ReservationEventHandler handler = mock(ReservationEventHandler.class);
		when(handler.eventType()).thenReturn(eventType);
		return handler;
	}

}
