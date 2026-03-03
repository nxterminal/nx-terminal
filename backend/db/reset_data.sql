-- ============================================================
-- NX TERMINAL: PHAROS MIGRATION — DATA RESET SCRIPT
-- ============================================================
-- Purpose: Wipe all MegaETH test data while preserving schema,
--          enums, functions, triggers, views, and indexes.
--
-- What gets DELETED:
--   - All player-generated data (devs, protocols, AIs, investments)
--   - All event logs (actions, chat messages, world events)
--   - All player data (wallets, balances, claims, purchases)
--   - All notifications and prompts
--   - World chat messages
--   - Balance snapshots and claim history
--
-- What is PRESERVED:
--   - All tables, columns, indexes, constraints, triggers
--   - All enums (archetypes, corps, locations, rarities, etc.)
--   - All functions (update_timestamp, recalc_player_balance)
--   - All views (leaderboard, protocol_market, ai_lab)
--   - Simulation state (reset to initial seed values)
--
-- IMPORTANT: Run inside a transaction so we can rollback on error.
-- ============================================================

SET search_path TO nx;

BEGIN;

-- ────────────────────────────────────────────────────────────
-- PHASE 1: Truncate ALL data tables in a single statement
--          CASCADE handles FK dependencies automatically.
--          Partitioned tables (actions, chat_messages) and
--          their default partitions are included.
-- ────────────────────────────────────────────────────────────

TRUNCATE TABLE
    players,
    devs,
    protocols,
    protocol_investments,
    absurd_ais,
    ai_votes,
    actions,
    chat_messages,
    world_events,
    world_chat,
    shop_purchases,
    player_prompts,
    notifications,
    claim_history,
    balance_snapshots
CASCADE;

-- ────────────────────────────────────────────────────────────
-- PHASE 4: Reset simulation state to initial seed values
-- ────────────────────────────────────────────────────────────

UPDATE simulation_state SET value = '"pre_launch"',  updated_at = NOW() WHERE key = 'simulation_status';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'current_cycle';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'total_devs_minted';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'total_nxt_circulation';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'total_nxt_spent';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'total_protocols_created';
UPDATE simulation_state SET value = '0',             updated_at = NOW() WHERE key = 'total_ais_created';
UPDATE simulation_state SET value = 'null',          updated_at = NOW() WHERE key = 'simulation_started_at';
UPDATE simulation_state SET value = 'null',          updated_at = NOW() WHERE key = 'simulation_ends_at';
UPDATE simulation_state SET value = 'false',         updated_at = NOW() WHERE key = 'endgame_triggered';

-- ────────────────────────────────────────────────────────────
-- PHASE 5: Reset sequences (so IDs start fresh from 1)
-- ────────────────────────────────────────────────────────────

ALTER SEQUENCE protocols_id_seq RESTART WITH 1;
ALTER SEQUENCE protocol_investments_id_seq RESTART WITH 1;
ALTER SEQUENCE absurd_ais_id_seq RESTART WITH 1;
ALTER SEQUENCE actions_id_seq RESTART WITH 1;
ALTER SEQUENCE chat_messages_id_seq RESTART WITH 1;
ALTER SEQUENCE world_events_id_seq RESTART WITH 1;
ALTER SEQUENCE shop_purchases_id_seq RESTART WITH 1;
ALTER SEQUENCE player_prompts_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE world_chat_id_seq RESTART WITH 1;
ALTER SEQUENCE claim_history_id_seq RESTART WITH 1;
ALTER SEQUENCE balance_snapshots_id_seq RESTART WITH 1;

-- ────────────────────────────────────────────────────────────
-- PHASE 6: Refresh materialized view (now empty)
-- ────────────────────────────────────────────────────────────

REFRESH MATERIALIZED VIEW leaderboard;

COMMIT;

-- ============================================================
-- VERIFICATION: Run these queries to confirm clean state
-- ============================================================
-- SELECT 'players' AS tbl, COUNT(*) FROM nx.players
-- UNION ALL SELECT 'devs', COUNT(*) FROM nx.devs
-- UNION ALL SELECT 'protocols', COUNT(*) FROM nx.protocols
-- UNION ALL SELECT 'protocol_investments', COUNT(*) FROM nx.protocol_investments
-- UNION ALL SELECT 'absurd_ais', COUNT(*) FROM nx.absurd_ais
-- UNION ALL SELECT 'ai_votes', COUNT(*) FROM nx.ai_votes
-- UNION ALL SELECT 'actions', COUNT(*) FROM nx.actions
-- UNION ALL SELECT 'chat_messages', COUNT(*) FROM nx.chat_messages
-- UNION ALL SELECT 'world_events', COUNT(*) FROM nx.world_events
-- UNION ALL SELECT 'world_chat', COUNT(*) FROM nx.world_chat
-- UNION ALL SELECT 'shop_purchases', COUNT(*) FROM nx.shop_purchases
-- UNION ALL SELECT 'player_prompts', COUNT(*) FROM nx.player_prompts
-- UNION ALL SELECT 'notifications', COUNT(*) FROM nx.notifications
-- UNION ALL SELECT 'claim_history', COUNT(*) FROM nx.claim_history
-- UNION ALL SELECT 'balance_snapshots', COUNT(*) FROM nx.balance_snapshots
-- UNION ALL SELECT 'simulation_state', COUNT(*) FROM nx.simulation_state;
-- -- Expected: all 0 except simulation_state = 10
