-- MySQL 8.4 one-time upgrade for accommodation TimeZone before issue #82.
-- Back up the database and verify the column/constraint does not exist first.

ALTER TABLE accommodations
    ADD COLUMN time_zone VARCHAR(50) NULL;

-- The former application-wide business zone was Asia/Seoul. Using that value
-- preserves existing booking and cancellation behavior without guessing location.
UPDATE accommodations
SET time_zone = 'Asia/Seoul'
WHERE time_zone IS NULL;

SELECT time_zone, COUNT(*) AS accommodation_count
FROM accommodations
GROUP BY time_zone
ORDER BY time_zone;

ALTER TABLE accommodations
    MODIFY COLUMN time_zone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    ADD CONSTRAINT chk_accommodations_time_zone CHECK (
        CHAR_LENGTH(TRIM(time_zone)) > 0
    );
