-- Add vital stat columns: caffeine, social_vitality, knowledge
-- These stats decay over time and are boosted by shop purchases

ALTER TABLE devs ADD COLUMN IF NOT EXISTS caffeine SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS social_vitality SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS knowledge SMALLINT NOT NULL DEFAULT 50;

-- Initialize social_vitality from stat_social for existing devs
UPDATE devs SET social_vitality = LEAST(100, GREATEST(15, stat_social)) WHERE social_vitality = 50;
