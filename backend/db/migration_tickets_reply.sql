-- Migration: extend support_tickets with admin-reply fields
-- Additive only (ADD COLUMN IF NOT EXISTS). Safe to run multiple
-- times. Auto-applied on API startup by _run_auto_migrations in
-- backend/api/main.py.

SET search_path TO nx;

ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS reply_text  TEXT,
    ADD COLUMN IF NOT EXISTS replied_by  VARCHAR(42),
    ADD COLUMN IF NOT EXISTS replied_at  TIMESTAMPTZ;

-- Any pre-existing row gets 'open' so the admin inbox surfaces them.
UPDATE support_tickets SET status = 'open' WHERE status IS NULL;

-- Hot path: admin inbox filters by status='open' ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_tickets_status_created
    ON support_tickets(status, created_at DESC)
    WHERE status = 'open';
