-- Issue #133: add the durable Reservation Consumer idempotency ledger.
-- Review and back up the target database before applying this one-time script.
-- Existing Kafka records are not backfilled because their processing history cannot
-- be reconstructed reliably from the current database.

CREATE TABLE IF NOT EXISTS processed_reservation_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    processed_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_processed_reservation_events PRIMARY KEY (id),
    CONSTRAINT uk_processed_reservation_events_event_id UNIQUE (event_id),
    CONSTRAINT chk_processed_reservation_event_aggregate_id CHECK (aggregate_id > 0)
);
