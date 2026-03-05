-- ============================================================
-- MIGRATION: Add DEPLOY action type, fix salary records
-- ============================================================
-- Run once against the live database.
--
-- 1. Adds 'DEPLOY' to the action_enum
-- 2. Converts old mint events from RECEIVE_SALARY to DEPLOY
--    (identified by details->>'event' = 'mint' and nxt_cost = 0)
-- ============================================================

SET search_path TO nx;

BEGIN;

-- Step 1: Add DEPLOY to the action_enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'DEPLOY'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum')
    ) THEN
        ALTER TYPE action_enum ADD VALUE 'DEPLOY';
    END IF;
END
$$;

COMMIT;

-- Step 2: Convert old mint RECEIVE_SALARY records to DEPLOY
-- (must be outside the DO block since the new enum value
--  needs to be committed before it can be used in DML)
BEGIN;

UPDATE actions
SET action_type = 'DEPLOY'
WHERE action_type = 'RECEIVE_SALARY'
  AND nxt_cost = 0
  AND details->>'event' = 'mint';

COMMIT;
