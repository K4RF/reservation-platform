-- MySQL 8.4 one-time upgrade for databases created before issue #59.
-- Back up the database and verify the preflight query before applying.
-- Do not run the ALTER statement if the column or constraint already exists.

SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'reservations'
  AND column_name = 'guest_count';

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND table_name = 'reservations'
  AND constraint_name = 'chk_reservations_guest_count';

ALTER TABLE reservations
    ADD COLUMN guest_count INT NOT NULL DEFAULT 1 AFTER room_id,
    ADD CONSTRAINT chk_reservations_guest_count CHECK (guest_count >= 1);

SELECT COUNT(*) AS invalid_reservation_guest_counts
FROM reservations
WHERE guest_count < 1;
