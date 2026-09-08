-- MySQL 8.4 one-time upgrade for reservations created before issue #78.
-- Back up the database and verify each column/table/constraint does not exist first.
-- Historical per-night prices and cancellation results cannot be reconstructed exactly.

ALTER TABLE reservations
    ADD COLUMN cancelled_at TIMESTAMP(6) NULL,
    ADD COLUMN cancellation_fee_amount DECIMAL(19, 2) NULL,
    ADD COLUMN refund_amount DECIMAL(19, 2) NULL;

ALTER TABLE reservations
    ADD CONSTRAINT chk_reservations_cancellation_result
        CHECK (
            (cancellation_fee_amount IS NULL OR cancellation_fee_amount >= 0)
            AND (refund_amount IS NULL OR refund_amount >= 0)
        );

CREATE TABLE reservation_nights (
    id BIGINT NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT NOT NULL,
    stay_date DATE NOT NULL,
    price_snapshot DECIMAL(12, 2) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_reservation_nights_reservation_date
        UNIQUE (reservation_id, stay_date),
    CONSTRAINT fk_reservation_nights_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations (id),
    CONSTRAINT chk_reservation_nights_price CHECK (price_snapshot >= 0)
);

SELECT status, COUNT(*) AS reservation_count
FROM reservations
GROUP BY status;

SELECT COUNT(*) AS reservation_night_count
FROM reservation_nights;
