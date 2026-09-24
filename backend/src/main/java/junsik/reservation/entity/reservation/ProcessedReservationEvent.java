package junsik.reservation.entity.reservation;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventMetadata;
import junsik.reservation.event.reservation.ReservationEventType;

@Entity
@Table(
		name = "processed_reservation_events",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_processed_reservation_events_event_id",
				columnNames = "event_id"
		),
		check = @CheckConstraint(
				name = "chk_processed_reservation_event_aggregate_id",
				constraint = "aggregate_id > 0"
		)
)
public class ProcessedReservationEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "event_id", nullable = false, length = 36)
	private String eventId;

	@Enumerated(EnumType.STRING)
	@Column(name = "event_type", nullable = false, length = 50)
	private ReservationEventType eventType;

	@Column(name = "aggregate_id", nullable = false)
	private Long aggregateId;

	@Column(name = "processed_at", nullable = false)
	private Instant processedAt;

	protected ProcessedReservationEvent() {
	}

	private ProcessedReservationEvent(ReservationEvent event, Instant processedAt) {
		ReservationEventMetadata metadata = Objects.requireNonNull(event, "event must not be null").metadata();
		this.eventId = metadata.eventId().toString();
		this.eventType = metadata.eventType();
		this.aggregateId = metadata.aggregateId();
		this.processedAt = Objects.requireNonNull(processedAt, "processedAt must not be null");
	}

	public static ProcessedReservationEvent create(ReservationEvent event, Instant processedAt) {
		return new ProcessedReservationEvent(event, processedAt);
	}

	public Long getId() {
		return id;
	}

	public UUID getEventId() {
		return UUID.fromString(eventId);
	}

	public ReservationEventType getEventType() {
		return eventType;
	}

	public Long getAggregateId() {
		return aggregateId;
	}

	public Instant getProcessedAt() {
		return processedAt;
	}
}
