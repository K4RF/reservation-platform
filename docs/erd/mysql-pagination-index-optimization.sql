-- Issue #114: reservation cursor pagination index for an existing MySQL development volume.
-- Back up the database and verify the current SHOW INDEX output before running once.

SHOW INDEX FROM reservations;

CREATE INDEX idx_reservations_member_id
    ON reservations (member_id, id);

-- The composite index keeps member_id as its leftmost prefix and replaces the old index.
DROP INDEX idx_reservations_member
    ON reservations;

ANALYZE TABLE reservations;

SHOW INDEX FROM reservations;
