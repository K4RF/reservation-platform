package junsik.reservation.event.reservation;

import org.springframework.stereotype.Component;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
public class ReservationOutboxEventSerializer {

	private final ObjectMapper objectMapper;

	public ReservationOutboxEventSerializer(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public String serialize(ReservationEvent event) {
		try {
			return objectMapper.writeValueAsString(event);
		} catch (JacksonException exception) {
			throw new IllegalStateException("Failed to serialize Reservation Event", exception);
		}
	}

	public ReservationEvent deserialize(ReservationEventType eventType, String payload) {
		try {
			return switch (eventType) {
				case RESERVATION_CREATED -> objectMapper.readValue(payload, ReservationCreatedEvent.class);
				case RESERVATION_CHANGED -> objectMapper.readValue(payload, ReservationChangedEvent.class);
				case RESERVATION_CANCELLED -> objectMapper.readValue(payload, ReservationCancelledEvent.class);
			};
		} catch (JacksonException exception) {
			throw new IllegalStateException("Failed to deserialize Reservation Event", exception);
		}
	}
}
