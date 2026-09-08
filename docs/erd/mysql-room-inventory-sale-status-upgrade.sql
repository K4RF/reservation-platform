-- MySQL 8.4 one-time upgrade for room inventories created before issue #77.
-- Verify that room_inventories.sale_status does not already exist before running.
-- Existing inventory remains sellable by backfilling OPEN; no rows are deleted.

SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'room_inventories'
  AND column_name = 'sale_status';

ALTER TABLE room_inventories
    ADD COLUMN sale_status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN'
        AFTER reserved_quantity;

SELECT sale_status, COUNT(*) AS inventory_count
FROM room_inventories
GROUP BY sale_status;
