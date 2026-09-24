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
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.ReservationEventMetadata;
import junsik.reservation.event.reservation.ReservationEventType;

@Entity
@Table(
		name = "reservation_outbox_events",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_reservation_outbox_events_event_id",
				columnNames = "event_id"
		),
		indexes = @Index(
				name = "idx_reservation_outbox_status_created",
				columnList = "status, created_at, id"
		),
		check = @CheckConstraint(
				name = "chk_reservation_outbox_event_values",
				constraint = "event_version > 0 AND publish_attempts >= 0"
		)
)
public class ReservationOutboxEvent {

	private static final int MAX_ERROR_LENGTH = 1000;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "event_id", nullable = false, length = 36)
	private String eventId;

	@Column(name = "aggregate_type", nullable = false, length = 50)
	private String aggregateType;

	@Column(name = "aggregate_id", nullable = false)
	private Long aggregateId;

	@Enumerated(EnumType.STRING)
	@Column(name = "event_type", nullable = false, length = 50)
	private ReservationEventType eventType;

	@Column(name = "event_version", nullable = false)
	private int eventVersion;

	@Lob
	@Column(name = "payload", nullable = false, columnDefinition = "LONGTEXT")
	private String payload;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private ReservationOutboxStatus status;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "published_at")
	private Instant publishedAt;

	@Column(name = "publish_attempts", nullable = false)
	private int publishAttempts;

	@Column(name = "last_attempt_at")
	private Instant lastAttemptAt;

	@Column(name = "last_error", length = MAX_ERROR_LENGTH)
	private String lastError;

	protected ReservationOutboxEvent() {
	}

	private ReservationOutboxEvent(ReservationEvent event, String payload) {
		ReservationEvent requiredEvent = Objects.requireNonNull(event, "event must not be null");
		ReservationEventMetadata metadata = requiredEvent.metadata();
		this.eventId = metadata.eventId().toString();
		this.aggregateType = metadata.aggregateType();
		this.aggregateId = metadata.aggregateId();
		this.eventType = metadata.eventType();
		this.eventVersion = metadata.schemaVersion();
		this.payload = requirePayload(payload);
		this.status = ReservationOutboxStatus.PENDING;
		this.createdAt = metadata.occurredAt();
		this.publishAttempts = 0;
	}

	public static ReservationOutboxEvent create(ReservationEvent event, String payload) {
		return new ReservationOutboxEvent(event, payload);
	}

	public void recordAttempt(Instant attemptedAt) {
		if (status != ReservationOutboxStatus.PENDING) {
			throw new IllegalStateException("Only pending Outbox events can be published");
		}
		this.publishAttempts++;
		this.lastAttemptAt = Objects.requireNonNull(attemptedAt, "attemptedAt must not be null");
		this.lastError = null;
	}

	public void markPublished(Instant publishedAt) {
		if (status != ReservationOutboxStatus.PENDING) {
			throw new IllegalStateException("Only pending Outbox events can be marked as published");
		}
		this.status = ReservationOutboxStatus.PUBLISHED;
		this.publishedAt = Objects.requireNonNull(publishedAt, "publishedAt must not be null");
		this.lastError = null;
	}

	public void recordFailure(String errorMessage) {
		if (status != ReservationOutboxStatus.PENDING) {
			throw new IllegalStateException("Only pending Outbox events can record a failure");
		}
		String message = Objects.requireNonNull(errorMessage, "errorMessage must not be null");
		this.lastError = message.substring(0, Math.min(message.length(), MAX_ERROR_LENGTH));
	}

	private String requirePayload(String payload) {
		if (payload == null || payload.isBlank()) {
			throw new IllegalArgumentException("payload must not be blank");
		}
		return payload;
	}

	public Long getId() {
		return id;
	}

	public UUID getEventId() {
		return UUID.fromString(eventId);
	}

	public String getAggregateType() {
		return aggregateType;
	}

	public Long getAggregateId() {
		return aggregateId;
	}

	public ReservationEventType getEventType() {
		return eventType;
	}

	public int getEventVersion() {
		return eventVersion;
	}

	public String getPayload() {
		return payload;
	}

	public ReservationOutboxStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getPublishedAt() {
		return publishedAt;
	}

	public int getPublishAttempts() {
		return publishAttempts;
	}

	public Instant getLastAttemptAt() {
		return lastAttemptAt;
	}

	public String getLastError() {
		return lastError;
	}
}
