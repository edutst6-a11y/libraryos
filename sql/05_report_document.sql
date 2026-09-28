-- ============================================================
-- Report document storage: lets staff edit the Project Report as
-- a document in the browser and save it back to PDF (see
-- /api/report/content and /api/report/pdf in the backend). Each
-- save inserts a new row so past versions are kept; the app always
-- reads the most recent one.
--
-- This table already exists in the production database (it was
-- created ad hoc before this migration was written down). The
-- IF NOT EXISTS guard makes this safe to run there too, purely to
-- bring the checked-in schema back in sync with what's deployed.
-- ============================================================
SET search_path TO library;

CREATE TABLE IF NOT EXISTS report_document (
    id              SERIAL PRIMARY KEY,
    html_content    TEXT NOT NULL,
    pdf_bytes       BYTEA NOT NULL,
    updated_by      VARCHAR(120),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_document_updated_at ON report_document(updated_at DESC);
