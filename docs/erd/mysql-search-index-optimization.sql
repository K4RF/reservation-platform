-- Issue #113: search index optimization for an existing MySQL development volume.
-- Back up the database and verify the current SHOW INDEX output before running once.

SHOW INDEX FROM accommodations;
SHOW INDEX FROM rooms;
CREATE INDEX idx_accommodations_city_region_status_id
    ON accommodations (city, region, status, id);

DROP INDEX idx_accommodations_city_region
    ON accommodations;

CREATE INDEX idx_rooms_accommodation_status_id
    ON rooms (accommodation_id, status, id);

-- InnoDB can remove the former generated FK index after a replacement index exists.
-- Check SHOW INDEX and drop a remaining single-column accommodation_id index only
-- when its exact local name is confirmed. The composite index supports the FK.

ANALYZE TABLE accommodations, rooms, room_inventories;

SHOW INDEX FROM accommodations;
SHOW INDEX FROM rooms;
