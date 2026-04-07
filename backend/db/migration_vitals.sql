-- ============================================================
-- MIGRATION: Add caffeine, social, knowledge columns to devs
-- ============================================================

ALTER TABLE devs ADD COLUMN IF NOT EXISTS caffeine INTEGER DEFAULT 50 NOT NULL;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS social INTEGER DEFAULT 50 NOT NULL;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS knowledge INTEGER DEFAULT 50 NOT NULL;

UPDATE devs SET caffeine = 50 WHERE caffeine IS NULL;
UPDATE devs SET social = 50 WHERE social IS NULL;
UPDATE devs SET knowledge = 50 WHERE knowledge IS NULL;
