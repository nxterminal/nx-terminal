-- Add caffeine vital stat column to devs table
-- caffeine decays over time and is boosted by coffee purchases

ALTER TABLE devs ADD COLUMN IF NOT EXISTS caffeine SMALLINT NOT NULL DEFAULT 50;
