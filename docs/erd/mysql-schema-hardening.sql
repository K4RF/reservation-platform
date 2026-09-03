-- MySQL 8.4 one-time upgrade for databases created before issue #46.
-- Verify that the named constraints do not already exist before running this file.
-- This script does not delete or rewrite application data.

SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
ORDER BY table_name, constraint_type, constraint_name;

SELECT COUNT(*) AS invalid_members
FROM members
WHERE char_length(trim(email)) = 0 OR char_length(password) = 0;

SELECT COUNT(*) AS invalid_social_accounts
FROM social_accounts
WHERE char_length(trim(provider_user_id)) = 0;

SELECT COUNT(*) AS invalid_accommodations
FROM accommodations
WHERE char_length(trim(name)) = 0
   OR char_length(trim(description)) = 0
   OR char_length(trim(address)) = 0;

SELECT COUNT(*) AS invalid_rooms
FROM rooms
WHERE char_length(trim(name)) = 0 OR capacity < 1 OR nightly_price < 0;

SELECT COUNT(*) AS invalid_reservations
FROM reservations
WHERE check_in_date >= check_out_date
   OR nightly_price_snapshot < 0
   OR total_amount < 0;

ALTER TABLE members
    ADD CONSTRAINT chk_members_required_text
        CHECK (char_length(trim(email)) > 0 AND char_length(password) > 0);

ALTER TABLE social_accounts
    ADD CONSTRAINT chk_social_accounts_provider_user_id
        CHECK (char_length(trim(provider_user_id)) > 0);

ALTER TABLE accommodations
    ADD CONSTRAINT chk_accommodations_required_text
        CHECK (
            char_length(trim(name)) > 0
            AND char_length(trim(description)) > 0
            AND char_length(trim(address)) > 0
        );

ALTER TABLE rooms
    ADD CONSTRAINT chk_rooms_business_values
        CHECK (char_length(trim(name)) > 0 AND capacity >= 1 AND nightly_price >= 0);

ALTER TABLE reservations
    ADD CONSTRAINT chk_reservations_business_values
        CHECK (
            check_in_date < check_out_date
            AND nightly_price_snapshot >= 0
            AND total_amount >= 0
        );
