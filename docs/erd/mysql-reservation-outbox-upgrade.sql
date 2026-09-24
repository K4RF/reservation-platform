-- Issue #132: add the Transactional Outbox table for Reservation lifecycle events.
-- Review and back up the target database before applying this one-time script.
-- The table intentionally has no FK to reservations so an immutable event record can
-- remain publishable even if aggregate retention rules change later.

CREATE TABLE IF NOT EXISTS reservation_outbox_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_version INT NOT NULL,
    payload LONGTEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    published_at DATETIME(6) NULL,
    publish_attempts INT NOT NULL DEFAULT 0,
    last_attempt_at DATETIME(6) NULL,
    last_error VARCHAR(1000) NULL,
    CONSTRAINT pk_reservation_outbox_events PRIMARY KEY (id),
    CONSTRAINT uk_reservation_outbox_events_event_id UNIQUE (event_id),
    CONSTRAINT chk_reservation_outbox_event_values
        CHECK (event_version > 0 AND publish_attempts >= 0),
    INDEX idx_reservation_outbox_status_created (status, created_at, id)
);
