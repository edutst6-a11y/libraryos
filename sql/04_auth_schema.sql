-- ============================================================
-- Auth extension: lets members and staff register/log in, and
-- adds the password-gated academic group-members section.
-- ============================================================
SET search_path TO library;

ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_number VARCHAR(20) UNIQUE;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Backfill membership numbers for the seeded members that predate this column
UPDATE members SET membership_number = 'LIB-' || LPAD(member_id::text, 6, '0')
WHERE membership_number IS NULL;

-- The academic group's own info, gated separately from the library's own
-- member/staff accounts -- this is metadata about the project, not a
-- circulation record, so it gets its own small table.
CREATE TABLE IF NOT EXISTS group_members (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    student_id  VARCHAR(40) NOT NULL,
    role        VARCHAR(60),
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS group_admin (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL
);
