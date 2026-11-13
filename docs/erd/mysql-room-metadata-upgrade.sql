-- MySQL 8.4, one-time #328 upgrade. Back up and verify columns/check are absent before execution.
-- No backfill: the four columns remain NULL for existing rooms.
ALTER TABLE rooms
    ADD COLUMN metadata_description VARCHAR(1000) NULL,
    ADD COLUMN metadata_bed_configuration VARCHAR(100) NULL,
    ADD COLUMN metadata_area_square_meters DECIMAL(6, 2) NULL,
    ADD COLUMN metadata_view VARCHAR(100) NULL,
    ADD CONSTRAINT chk_rooms_metadata_values CHECK (
        (metadata_description IS NULL OR CHAR_LENGTH(TRIM(metadata_description)) > 0)
        AND (metadata_bed_configuration IS NULL OR CHAR_LENGTH(TRIM(metadata_bed_configuration)) > 0)
        AND (metadata_area_square_meters IS NULL OR metadata_area_square_meters BETWEEN 0.01 AND 9999.99)
        AND (metadata_view IS NULL OR CHAR_LENGTH(TRIM(metadata_view)) > 0)
    );
