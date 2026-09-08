-- MySQL 8.4 one-time upgrade for accommodation catalog data before issue #79.
-- Back up the database and verify each column/table/index does not exist first.
-- Existing address strings cannot be split into structured location data safely.

ALTER TABLE accommodations
    ADD COLUMN country VARCHAR(100) NULL,
    ADD COLUMN city VARCHAR(100) NULL,
    ADD COLUMN region VARCHAR(100) NULL;

CREATE INDEX idx_accommodations_city_region
    ON accommodations (city, region);

CREATE INDEX idx_accommodations_region
    ON accommodations (region);

CREATE TABLE accommodation_amenities (
    accommodation_id BIGINT NOT NULL,
    amenity ENUM('PARKING', 'BREAKFAST', 'POOL', 'GYM', 'PET_FRIENDLY') NOT NULL,
    CONSTRAINT uk_accommodation_amenities_accommodation_amenity
        UNIQUE (accommodation_id, amenity),
    CONSTRAINT fk_accommodation_amenities_accommodation
        FOREIGN KEY (accommodation_id) REFERENCES accommodations (id)
);

CREATE TABLE room_amenities (
    room_id BIGINT NOT NULL,
    amenity ENUM('WIFI', 'AIR_CONDITIONER') NOT NULL,
    CONSTRAINT uk_room_amenities_room_amenity
        UNIQUE (room_id, amenity),
    CONSTRAINT fk_room_amenities_room
        FOREIGN KEY (room_id) REFERENCES rooms (id)
);

SELECT COUNT(*) AS legacy_accommodation_count
FROM accommodations
WHERE country IS NULL OR city IS NULL OR region IS NULL;
