"""Test seed helpers — `seed_player`, `seed_dev`.

Why this exists
---------------
Phase 5.3.5 unified the production-side schema source of truth into
`backend.db.migrate.run_auto_migrations`. The Phase 5.3.5b
reconnaissance report (PR descriptions for the recon pass) showed
that 145 of the 28-deferred test files' failures fell into 3 fix
patterns, with 97% of the failures centralizable. The two largest
clusters were:

  C1a — 106 failures from `INSERT INTO players (wallet_address)`
        without supplying the production-required `corporation`
        NOT NULL column.
  C1b —  58 failures from `INSERT INTO devs (...)` calls that
        omitted required columns (`name`, `corporation`,
        `archetype`, `personality_seed`).

This module is the centralized fix: each helper builds an INSERT
dynamically from caller-provided kwargs + sane test defaults, so a
test can write `seed_player(cur, addr)` instead of repeating the
column list every time. Defaults match the production schema's
NOT NULL columns exactly so a bare call always succeeds against a
fresh `run_auto_migrations` schema.

Design notes
------------
- Parameterised psycopg2 queries (`%s` placeholders), never string
  formatting. Column NAMES are validated against an allowlist
  derived from the production schema; column VALUES are passed as
  bound params.
- Caller controls the transaction. No `commit()` here.
- Required positional args raise `ValueError` if missing. Optional
  kwargs accept None where the schema does, default to safe values
  where it doesn't.
- No teardown / cleanup helpers. Tests own their own `clean`
  fixtures (TRUNCATE etc).
- Limited to `players` and `devs` for this PR — the two tables
  driving 164/198 of the deferred-test failures. Extend to more
  tables when the cost/benefit calculus warrants it.

Usage
-----
    from backend.tests._seed import seed_player, seed_dev

    seed_player(cur, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    seed_dev(cur, token_id=1, owner_address="0xaaaa...aaaa")
    seed_dev(cur, token_id=2, owner_address="0xbbbb...bbbb",
             corporation="MISANTHROPIC", balance_nxt=500)
"""

from __future__ import annotations

from typing import Any


# Columns we allow callers to override. The values themselves are
# parameter-bound, but the column NAMES go into the SQL string verbatim,
# so an allowlist is what makes this safe against SQL injection from a
# typo-prone test caller.
_PLAYERS_COLUMNS = frozenset({
    "wallet_address", "display_name", "corporation",
    "total_devs_minted", "balance_claimable", "balance_claimed",
    "balance_total_earned", "created_at", "last_active_at",
})

_DEVS_COLUMNS = frozenset({
    "token_id", "name", "owner_address", "archetype", "corporation",
    "rarity_tier", "personality_seed", "species", "background",
    "accessory", "expression", "special_effect", "ipfs_hash",
    "alignment", "risk_level", "social_style", "coding_style",
    "work_ethic", "stat_coding", "stat_hacking", "stat_trading",
    "stat_social", "stat_endurance", "stat_luck", "skin", "clothing",
    "vibe", "glow", "hair_style", "hair_color", "facial", "headgear",
    "extra", "energy", "max_energy", "mood", "location", "balance_nxt",
    "reputation", "status", "day", "coffee_count", "lines_of_code",
    "bugs_shipped", "bugs_fixed", "hours_since_sleep",
    "protocols_created", "protocols_failed", "ais_created",
    "biggest_win", "total_earned", "total_spent", "total_invested",
    "code_reviews_done", "bugs_found", "cycles_active",
    "last_action_type", "last_action_detail", "last_action_at",
    "last_message", "last_message_channel", "caffeine",
    "social_vitality", "knowledge", "pc_health", "training_course",
    "training_ends_at", "last_raid_at", "next_cycle_at",
    "cycle_interval_sec", "minted_at", "updated_at",
    "sync_status", "sync_tx_hash", "sync_started_at",
})


def _build_insert(table: str, columns: dict[str, Any]) -> tuple[str, list]:
    """Compose an INSERT statement from a column→value dict. Returns
    (sql, params) ready for `cur.execute`. Caller has already
    validated column names against the table's allowlist.

    `ON CONFLICT DO NOTHING` is appended unconditionally — every
    test caller is happy with a no-op when the row already exists.
    """
    cols = list(columns.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    sql = (
        f"INSERT INTO {table} ({', '.join(cols)}) "
        f"VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    )
    return sql, [columns[c] for c in cols]


def seed_player(
    cur,
    wallet_address: str,
    *,
    corporation: str = "CLOSED_AI",
    **overrides: Any,
) -> str:
    """Insert one row into `players` with sane test defaults.

    Required:
      - cur: psycopg2 cursor (caller owns the transaction).
      - wallet_address: 0x-prefixed 42-char hex string.

    Defaults applied automatically:
      - corporation='CLOSED_AI' (any valid corporation_enum value works).

    Anything else can be passed as a kwarg and overrides the default.
    Unknown columns raise `ValueError` (typo-protection).

    Returns: the wallet_address (for caller convenience).

    Example:
        seed_player(cur, "0xaaaa...aaaa")
        seed_player(cur, "0xbbbb...bbbb", corporation="MISANTHROPIC",
                    display_name="bread")
    """
    if not wallet_address:
        raise ValueError("seed_player: wallet_address is required")

    cols: dict[str, Any] = {
        "wallet_address": wallet_address,
        "corporation": corporation,
    }
    for key, val in overrides.items():
        if key not in _PLAYERS_COLUMNS:
            raise ValueError(
                f"seed_player: unknown column {key!r} for players table"
            )
        cols[key] = val

    sql, params = _build_insert("players", cols)
    cur.execute(sql, params)
    return wallet_address


def seed_dev(
    cur,
    token_id: int,
    owner_address: str,
    *,
    name: str | None = None,
    archetype: str = "10X_DEV",
    corporation: str = "CLOSED_AI",
    personality_seed: int = 1,
    balance_nxt: int = 0,
    **overrides: Any,
) -> int:
    """Insert one row into `devs` with sane test defaults.

    Required:
      - cur: psycopg2 cursor.
      - token_id: int.
      - owner_address: 0x-prefixed 42-char hex string. Must already
        be present in `players` (FK constraint) — call seed_player
        first if needed.

    Defaults applied automatically:
      - name=f"dev_{token_id}" (auto-generates to satisfy the
        UNIQUE constraint without forcing every test to invent
        unique names; pass `name=` to override).
      - archetype='10X_DEV' (any valid archetype_enum value works).
      - corporation='CLOSED_AI'.
      - personality_seed=1 (any non-null bigint).

    Anything else can be passed as a kwarg and overrides the default.
    Unknown columns raise `ValueError`.

    Returns: the token_id.

    Example:
        seed_dev(cur, token_id=1, owner_address="0xaaaa...aaaa")
        seed_dev(cur, token_id=2, owner_address="0xbbbb...bbbb",
                 corporation="MISANTHROPIC", balance_nxt=100,
                 status="on_mission")
    """
    if token_id is None:
        raise ValueError("seed_dev: token_id is required")
    if not owner_address:
        raise ValueError("seed_dev: owner_address is required")

    # Auto-satisfy the FK to players. The production schema declares
    # `devs.owner_address REFERENCES players(wallet_address)`, but the
    # historical MINIMAL_SCHEMAs didn't have this FK and most tests
    # call seed_dev without first calling seed_player. The implicit
    # seed_player here is `ON CONFLICT DO NOTHING`, so callers that
    # already seeded the player aren't double-charged. The defaulting
    # corporation matches the seed_player default.
    seed_player(cur, owner_address, corporation=corporation)

    cols: dict[str, Any] = {
        "token_id": token_id,
        "owner_address": owner_address,
        "name": name if name is not None else f"dev_{token_id}",
        "archetype": archetype,
        "corporation": corporation,
        "personality_seed": personality_seed,
        # The production schema declares
        # `balance_nxt BIGINT NOT NULL DEFAULT 2000` (newly minted Devs
        # start with 2000 NXT in the live game). Test code, however,
        # was written against the historical MINIMAL_SCHEMAs where the
        # default was 0; assertions like `assert dev_balance == 100`
        # expected a freshly-seeded dev to start empty. Default to 0
        # here so tests keep their original semantics — pass
        # balance_nxt=2000 explicitly when a test wants to mirror the
        # production initial balance.
        "balance_nxt": balance_nxt,
    }
    for key, val in overrides.items():
        if key not in _DEVS_COLUMNS:
            raise ValueError(
                f"seed_dev: unknown column {key!r} for devs table"
            )
        cols[key] = val

    sql, params = _build_insert("devs", cols)
    cur.execute(sql, params)
    return token_id
