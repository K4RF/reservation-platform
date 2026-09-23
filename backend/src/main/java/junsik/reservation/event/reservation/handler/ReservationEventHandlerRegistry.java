package junsik.reservation.event.reservation.handler;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventType;

@Component
public class ReservationEventHandlerRegistry {

	private final Map<ReservationEventType, ReservationEventHandler> handlers;

	public ReservationEventHandlerRegistry(List<ReservationEventHandler> handlers) {
		Map<ReservationEventType, ReservationEventHandler> mappedHandlers =
				new EnumMap<>(ReservationEventType.class);
		for (ReservationEventHandler handler : handlers) {
			ReservationEventHandler previous = mappedHandlers.put(handler.eventType(), handler);
			if (previous != null) {
				throw new IllegalStateException("Duplicate Reservation Event handler: " + handler.eventType());
			}
		}
		for (ReservationEventType eventType : ReservationEventType.values()) {
			if (!mappedHandlers.containsKey(eventType)) {
				throw new IllegalStateException("Missing Reservation Event handler: " + eventType);
			}
		}
		this.handlers = Map.copyOf(mappedHandlers);
	}

	public void handle(ReservationEvent event) {
		handlers.get(event.metadata().eventType()).handle(event);
	}
}
