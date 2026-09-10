-- MySQL 8.4 one-time upgrade for room inventories created before issue #95.
-- Verify that room_inventories.version does not already exist before running.
-- Existing rows start at version 0; no inventory quantities or reservations are changed.

SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'room_inventories'
  AND column_name = 'version';

ALTER TABLE room_inventories
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0
        AFTER reserved_quantity;

SELECT version, COUNT(*) AS inventory_count
FROM room_inventories
GROUP BY version;
