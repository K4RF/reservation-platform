-- MySQL 8.4 one-time upgrade for reservation details before issue #80.
-- Back up the database and verify each column/constraint does not exist first.

ALTER TABLE accommodations
    ADD COLUMN check_in_time TIME NULL,
    ADD COLUMN check_out_time TIME NULL,
    ADD CONSTRAINT chk_accommodations_operating_times CHECK (
        (check_in_time IS NULL AND check_out_time IS NULL)
        OR (
            check_in_time IS NOT NULL
            AND check_out_time IS NOT NULL
            AND check_in_time <> check_out_time
        )
    );

ALTER TABLE reservations
    ADD COLUMN reservation_number VARCHAR(40) NULL,
    ADD COLUMN guest_name VARCHAR(100) NULL,
    ADD COLUMN guest_email VARCHAR(255) NULL,
    ADD COLUMN guest_phone VARCHAR(30) NULL;

-- reservations has no historical creation timestamp, so the date segment records
-- this one-time migration date rather than claiming an unknown original creation date.
UPDATE reservations
SET reservation_number = CONCAT(
        'RSV-',
        DATE_FORMAT(CURRENT_DATE, '%Y%m%d'),
        '-',
        UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 16))
    )
WHERE reservation_number IS NULL;

SELECT reservation_number, COUNT(*) AS duplicate_count
FROM reservations
GROUP BY reservation_number
HAVING COUNT(*) > 1;

ALTER TABLE reservations
    MODIFY COLUMN reservation_number VARCHAR(40) NOT NULL,
    ADD CONSTRAINT uk_reservations_reservation_number UNIQUE (reservation_number),
    ADD CONSTRAINT chk_reservations_reservation_number CHECK (
        CHAR_LENGTH(TRIM(reservation_number)) > 0
    ),
    ADD CONSTRAINT chk_reservations_representative_guest CHECK (
        (guest_name IS NULL AND guest_email IS NULL AND guest_phone IS NULL)
        OR (
            guest_name IS NOT NULL
            AND guest_email IS NOT NULL
            AND guest_phone IS NOT NULL
            AND CHAR_LENGTH(TRIM(guest_name)) > 0
            AND CHAR_LENGTH(TRIM(guest_email)) > 0
            AND CHAR_LENGTH(TRIM(guest_phone)) > 0
        )
    );

SELECT COUNT(*) AS accommodations_without_operating_times
FROM accommodations
WHERE check_in_time IS NULL OR check_out_time IS NULL;

SELECT COUNT(*) AS reservations_without_representative_guest
FROM reservations
WHERE guest_name IS NULL OR guest_email IS NULL OR guest_phone IS NULL;
