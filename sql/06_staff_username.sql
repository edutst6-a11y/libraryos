-- ============================================================
-- Staff username login: staff sign in with a username instead of
-- their email (see /api/auth/login in the backend, which looks
-- staff up by email OR username). Like report_document, this
-- column already exists in the production database from when the
-- feature shipped; this migration brings the checked-in schema
-- back in sync so a fresh database has it too.
-- ============================================================
SET search_path TO library;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS username VARCHAR(60) UNIQUE;

-- Backfill a deterministic, unique username for any staff row that
-- doesn't have one yet (existing seeded staff, or a fresh load of
-- 02_seed_data.sql), derived from their name plus their staff_id
-- so it can never collide.
UPDATE staff
SET username = lower(regexp_replace(full_name, '[^a-zA-Z0-9]', '', 'g')) || staff_id::text
WHERE username IS NULL;
