-- ============================================================
-- NX TERMINAL: Game Mechanics Migration
-- Run manually on Render DB: psql $DATABASE_URL -f backend/db/migration_mechanics.sql
-- ============================================================

SET search_path TO nx;

-- New dev fields for game mechanics
ALTER TABLE devs ADD COLUMN IF NOT EXISTS pc_health SMALLINT NOT NULL DEFAULT 100;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS training_course VARCHAR(30) DEFAULT NULL;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS training_ends_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE devs ADD COLUMN IF NOT EXISTS last_raid_at TIMESTAMPTZ DEFAULT NULL;

-- New action types for mechanics
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BUY_ITEM' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'BUY_ITEM'; END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FIX_BUG' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'FIX_BUG'; END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRAIN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'TRAIN'; END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_RAID' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'HACK_RAID'; END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_MAINFRAME' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'HACK_MAINFRAME'; END IF;
END $$;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'nx' AND table_name = 'devs'
  AND column_name IN ('pc_health', 'training_course', 'training_ends_at', 'last_raid_at');

SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum')
ORDER BY enumsortorder;
