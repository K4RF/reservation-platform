-- Issue #272. Review and back up the intended database before applying once.
-- Adds only an empty Media table. Do NOT infer historic photos/alt/rights or
-- attach prototype assets. Does not change existing catalog/reservation rows.
-- ddl-auto=update is not a substitute for reviewing pre-existing constraints.
CREATE TABLE IF NOT EXISTS catalog_media (
    id BIGINT NOT NULL AUTO_INCREMENT,
    accommodation_id BIGINT NULL,
    room_id BIGINT NULL,
    storage_key VARCHAR(41) NOT NULL,
    format ENUM('JPEG', 'PNG', 'WEBP') NOT NULL,
    alt_text VARCHAR(300) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    byte_size BIGINT NOT NULL,
    sort_order INT NOT NULL,
    source VARCHAR(500) NOT NULL,
    rights_record VARCHAR(1000) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_catalog_media_storage_key UNIQUE (storage_key),
    CONSTRAINT fk_catalog_media_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodations(id),
    CONSTRAINT fk_catalog_media_room FOREIGN KEY (room_id) REFERENCES rooms(id),
    CONSTRAINT chk_catalog_media_owner CHECK (
        (accommodation_id IS NOT NULL AND room_id IS NULL) OR
        (accommodation_id IS NULL AND room_id IS NOT NULL)
    ),
    CONSTRAINT chk_catalog_media_dimensions CHECK (
        width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192 AND byte_size BETWEEN 1 AND 10485760
    ),
    CONSTRAINT chk_catalog_media_order CHECK (sort_order >= 0),
    CONSTRAINT chk_catalog_media_text CHECK (
        CHAR_LENGTH(TRIM(alt_text)) > 0 AND CHAR_LENGTH(TRIM(source)) > 0 AND CHAR_LENGTH(TRIM(rights_record)) > 0
    ),
    INDEX idx_catalog_media_accommodation_order (accommodation_id, sort_order, id),
    INDEX idx_catalog_media_room_order (room_id, sort_order, id)
);
