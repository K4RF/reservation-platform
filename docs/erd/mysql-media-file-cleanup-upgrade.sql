-- Issue #273: durable unclaimed/obsolete Media file intents.
-- Review the intended DB and back up DB plus MEDIA_STORAGE_ROOT before running once.
-- Requires the #272 catalog_media table; no existing catalog/photo/rights backfill.
CREATE TABLE IF NOT EXISTS media_file_cleanup (
    storage_key VARCHAR(41) NOT NULL,
    next_attempt_at DATETIME(6) NOT NULL,
    attempts INT NOT NULL,
    last_failure VARCHAR(100) NULL,
    PRIMARY KEY (storage_key),
    CONSTRAINT chk_media_cleanup_attempts CHECK (attempts >= 0),
    INDEX idx_media_cleanup_due (next_attempt_at, storage_key)
);
