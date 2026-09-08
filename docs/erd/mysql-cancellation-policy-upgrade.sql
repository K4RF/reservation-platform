-- MySQL 8.4 one-time upgrade for databases created before issue #76.
-- Back up the database and verify each column/constraint does not exist first.
-- This preserves existing reservations with the former global cancellation policy.

ALTER TABLE reservations
    ADD COLUMN free_cancellation_days_before_check_in INT NOT NULL DEFAULT 7,
    ADD COLUMN cancellation_deadline_days_before_check_in INT NOT NULL DEFAULT 1;

ALTER TABLE reservations
    ADD CONSTRAINT chk_reservations_cancellation_policy_snapshot
        CHECK (
            cancellation_deadline_days_before_check_in >= 0
            AND free_cancellation_days_before_check_in
                > cancellation_deadline_days_before_check_in
        );

CREATE TABLE accommodation_cancellation_policies (
    id BIGINT NOT NULL AUTO_INCREMENT,
    accommodation_id BIGINT NOT NULL,
    free_cancellation_days_before_check_in INT NOT NULL,
    cancellation_deadline_days_before_check_in INT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_cancellation_policies_accommodation UNIQUE (accommodation_id),
    CONSTRAINT fk_cancellation_policies_accommodation
        FOREIGN KEY (accommodation_id) REFERENCES accommodations (id),
    CONSTRAINT chk_cancellation_policies_period CHECK (
        cancellation_deadline_days_before_check_in >= 0
        AND free_cancellation_days_before_check_in
            > cancellation_deadline_days_before_check_in
    )
);

CREATE TABLE cancellation_policy_fee_rules (
    cancellation_policy_id BIGINT NOT NULL,
    rule_order INT NOT NULL,
    min_days_before_check_in INT NOT NULL,
    fee_rate_percent INT NOT NULL,
    CONSTRAINT uk_cancellation_fee_rules_policy_order
        UNIQUE (cancellation_policy_id, rule_order),
    CONSTRAINT fk_cancellation_fee_rules_policy
        FOREIGN KEY (cancellation_policy_id)
            REFERENCES accommodation_cancellation_policies (id),
    CHECK (min_days_before_check_in >= 0),
    CHECK (fee_rate_percent BETWEEN 1 AND 100)
);

CREATE TABLE reservation_cancellation_fee_snapshots (
    reservation_id BIGINT NOT NULL,
    rule_order INT NOT NULL,
    min_days_before_check_in INT NOT NULL,
    fee_rate_percent INT NOT NULL,
    CONSTRAINT uk_cancellation_fee_snapshots_reservation_order
        UNIQUE (reservation_id, rule_order),
    CONSTRAINT fk_cancellation_fee_snapshots_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations (id),
    CHECK (min_days_before_check_in >= 0),
    CHECK (fee_rate_percent BETWEEN 1 AND 100)
);

INSERT INTO reservation_cancellation_fee_snapshots (
    reservation_id, rule_order, min_days_before_check_in, fee_rate_percent
)
SELECT id, 0, 3, 30
FROM reservations;

INSERT INTO reservation_cancellation_fee_snapshots (
    reservation_id, rule_order, min_days_before_check_in, fee_rate_percent
)
SELECT id, 1, 1, 50
FROM reservations;
