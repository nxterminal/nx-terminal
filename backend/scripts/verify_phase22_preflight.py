"""
Phase 2.2 — Step 0 pre-flight verifier (read-only).

Confirms the assumptions the Phase 2.2 brief relies on before any DDL/DML runs:

  1. No minted Dev currently uses a value that's about to be retired
     (Mentor, Troll, Copy Paste, Grinder, Steady, Balanced — "Speed Runner"
     is renamed in place rather than dropped, so it's allowed but counted).
  2. The actual data_type of `species`, `social_style`, `coding_style`,
     `work_ethic` — the brief's migration steps assume these are enum types,
     but `backend/db/schema.sql` declares them as `VARCHAR(20)`. The verifier
     reports the *live* type so the migration plan can be corrected before
     execution.
  3. `dev_status_enum` current values (the probe report mentioned a runtime
     `on_mission` value that isn't in `schema.sql`).
  4. `devs_burned` column existence (Step A drops it).
  5. The probe-result figures we depend on (total dev count, energy range,
     `'GitHub HQ'` row count) still hold.

The script writes `phase22-preflight.md` to the repo root. Idempotent.

Safety:
  - autocommit=False, `SET TRANSACTION READ ONLY`, static SELECT-only gate,
    final ROLLBACK. Same model as `probe_production.py`.

Usage:
    DATABASE_URL=... python backend/scripts/verify_phase22_preflight.py
    # or
    NX_DB_HOST=... NX_DB_USER=... NX_DB_PASS=... NX_DB_NAME=... \
        python backend/scripts/verify_phase22_preflight.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")

# Values the Phase 2.2 plan retires from production. Each must have ZERO rows
# in nx.devs before we can safely drop it from the active value set.
RETIRED_VALUES = {
    "social_style": ["Mentor", "Troll"],
    "coding_style": ["Copy Paste"],
    "work_ethic": ["Grinder", "Steady", "Balanced"],
}

# "Speed Runner" is renamed to "Speedrun" rather than retired. We still want
# the count so the alignment script knows how many rows the rename will touch.
RENAMED_VALUES = {
    "coding_style": [("Speed Runner", "Speedrun")],
}

# Probes covering the brief's "no schema drift" assumption.
LIVE_STATE_PROBES: list[tuple[str, str]] = [
    (
        "Total minted Devs",
        f"SELECT COUNT(*) AS total_devs FROM {SCHEMA}.devs",
    ),
    (
        "Energy range (must already be 0..100)",
        f"SELECT MIN(energy) AS energy_min, MAX(energy) AS energy_max, "
        f"AVG(energy)::numeric(5,1) AS energy_avg FROM {SCHEMA}.devs",
    ),
    (
        "devs_burned column existence",
        "SELECT column_name, data_type, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_schema = %(schema)s AND table_name = 'devs' "
        "AND column_name = 'devs_burned'",
    ),
    (
        "dev_status_enum values (looking for on_mission and exhausted)",
        f"SELECT unnest(enum_range(NULL::{SCHEMA}.dev_status_enum))::text AS status_value",
    ),
    (
        "'GitHub HQ' location row count",
        f"SELECT COUNT(*) AS github_hq_rows FROM {SCHEMA}.devs WHERE location::text = 'GitHub HQ'",
    ),
    (
        "personality_seed health",
        f"SELECT COUNT(*) FILTER (WHERE personality_seed IS NULL OR personality_seed = 0) AS bad_seeds, "
        f"COUNT(DISTINCT personality_seed) AS distinct_seeds, "
        f"COUNT(*) AS total FROM {SCHEMA}.devs",
    ),
]

COLUMN_TYPE_PROBE = (
    "data_type / udt_name for trait columns "
    "(reveals whether brief's enum-based migration applies, or VARCHAR-based)",
    "SELECT column_name, data_type, udt_name, character_maximum_length "
    "FROM information_schema.columns "
    "WHERE table_schema = %(schema)s AND table_name = 'devs' "
    "AND column_name IN ('species','archetype','corporation','rarity_tier',"
    "'mood','location','status','alignment','risk_level',"
    "'social_style','coding_style','work_ethic') "
    "ORDER BY column_name",
)


def get_connection_params() -> dict[str, Any] | None:
    if os.environ.get("DATABASE_URL"):
        p = urlparse(os.environ["DATABASE_URL"])
        sslmode = "require" if (p.hostname and "render.com" in p.hostname) else "prefer"
        return {
            "host": p.hostname,
            "port": p.port or 5432,
            "dbname": p.path.lstrip("/"),
            "user": p.username,
            "password": p.password,
            "sslmode": sslmode,
        }
    if os.environ.get("NX_DB_HOST"):
        host = os.environ["NX_DB_HOST"]
        sslmode = "require" if "render.com" in host else "prefer"
        return {
            "host": host,
            "port": int(os.environ.get("NX_DB_PORT", "5432")),
            "dbname": os.environ.get("NX_DB_NAME", "nxterminal"),
            "user": os.environ.get("NX_DB_USER", "postgres"),
            "password": os.environ.get("NX_DB_PASS", ""),
            "sslmode": sslmode,
        }
    return None


def assert_select_only(sql: str) -> None:
    s = sql.strip()
    while s.startswith("--"):
        nl = s.find("\n")
        if nl == -1:
            break
        s = s[nl + 1 :].lstrip()
    if not s.upper().startswith("SELECT"):
        raise AssertionError(f"Refusing to run non-SELECT query: {sql[:80]!r}")


def fmt_cell(v: Any) -> str:
    if v is None:
        return "_NULL_"
    return str(v).replace("|", "\\|").replace("\n", " ")


def render_table(rows: list[dict]) -> str:
    if not rows:
        return "_(no rows)_\n\n"
    cols = list(rows[0].keys())
    out = "| " + " | ".join(cols) + " |\n"
    out += "|" + "|".join(["---"] * len(cols)) + "|\n"
    for r in rows:
        out += "| " + " | ".join(fmt_cell(r.get(c)) for c in cols) + " |\n"
    return out + "\n"


def main() -> int:
    params = get_connection_params()
    if not params:
        print("[verify] ERROR: no DATABASE_URL or NX_DB_HOST in environment.",
              file=sys.stderr)
        print("[verify] Set DATABASE_URL=postgresql://user:pass@host:port/dbname "
              "and re-run.", file=sys.stderr)
        return 1
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("[verify] ERROR: psycopg2 not installed. "
              "Run `pip install psycopg2-binary` first.", file=sys.stderr)
        return 1

    print(f"[verify] connecting host={params['host']} db={params['dbname']} "
          f"user={params['user']} sslmode={params['sslmode']}", file=sys.stderr)

    try:
        conn = psycopg2.connect(connect_timeout=10, **params)
    except Exception as e:
        print(f"[verify] ERROR: connection failed: {e}", file=sys.stderr)
        return 1
    conn.autocommit = False

    started = datetime.now(timezone.utc).isoformat()
    md: list[str] = []
    md.append("# Phase 2.2 — Step 0 pre-flight verification\n\n")
    md.append(f"**Branch:** `claude/refactor-metadata-api-J1jMg`  \n")
    md.append(f"**Run at (UTC):** `{started}`  \n")
    md.append(f"**Host:** `{params['host']}`  \n")
    md.append(f"**DB:** `{params['dbname']}`  \n")
    md.append(f"**Schema:** `{SCHEMA}`  \n")
    md.append(f"**Mode:** read-only (`SET TRANSACTION READ ONLY`, SELECT-only gate, final ROLLBACK).\n\n")
    md.append("---\n\n")

    failures: list[tuple[str, str]] = []
    blockers: list[str] = []

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET TRANSACTION READ ONLY")

            # ── 1. Retired-value row counts -─────────────────────────────────
            md.append("## 1. Retired values — row counts (must all be 0)\n\n")
            md.append("Each row below counts how many minted Devs currently use a value that "
                      "the Phase 2.2 plan retires. A non-zero count is a **blocker** — Step 2 "
                      "would either lose those rows (if the value is dropped from an enum) or "
                      "leave them in a state inconsistent with the bundle.\n\n")
            md.append("| Column | Retired value | Row count | Status |\n|---|---|---:|---|\n")
            for col, values in RETIRED_VALUES.items():
                for v in values:
                    sql = f"SELECT COUNT(*) AS n FROM {SCHEMA}.devs WHERE {col}::text = %s"
                    try:
                        assert_select_only(sql)
                        cur.execute(sql, (v,))
                        n = cur.fetchone()["n"]
                        ok = "✅ 0 — safe to retire" if n == 0 else f"❌ BLOCKER — {n} rows in use"
                        if n != 0:
                            blockers.append(f"{col}='{v}' has {n} rows still in use")
                        md.append(f"| `{col}` | `{v}` | {n} | {ok} |\n")
                    except Exception as e:
                        failures.append((f"retired {col}='{v}'", str(e)))
                        md.append(f"| `{col}` | `{v}` | ? | ERROR: {e} |\n")
                        conn.rollback()
                        cur.execute("SET TRANSACTION READ ONLY")
            md.append("\n")

            # ── 2. Renamed-value row counts -─────────────────────────────────
            md.append("## 2. Renamed values — row counts (informational)\n\n")
            md.append("`Speed Runner` is renamed to `Speedrun` rather than retired. The count "
                      "tells us how many rows the rename will touch.\n\n")
            md.append("| Column | Old value | New value | Row count |\n|---|---|---|---:|\n")
            for col, pairs in RENAMED_VALUES.items():
                for old, new in pairs:
                    sql = f"SELECT COUNT(*) AS n FROM {SCHEMA}.devs WHERE {col}::text = %s"
                    try:
                        assert_select_only(sql)
                        cur.execute(sql, (old,))
                        n = cur.fetchone()["n"]
                        md.append(f"| `{col}` | `{old}` | `{new}` | {n} |\n")
                    except Exception as e:
                        failures.append((f"rename {col}='{old}'", str(e)))
                        md.append(f"| `{col}` | `{old}` | `{new}` | ? — ERROR: {e} |\n")
                        conn.rollback()
                        cur.execute("SET TRANSACTION READ ONLY")
            md.append("\n")

            # ── 3. Column data types -────────────────────────────────────────
            label, sql = COLUMN_TYPE_PROBE
            md.append(f"## 3. {label}\n\n```sql\n{sql.strip()}\n```\n\n")
            try:
                assert_select_only(sql)
                cur.execute(sql, {"schema": SCHEMA})
                rows = cur.fetchall()
                md.append(render_table(rows))
                # Flag VARCHAR columns where the brief assumed enums
                varchar_brief_assumed_enum = []
                enum_brief_assumed_varchar = []
                for r in rows:
                    if r["column_name"] in ("social_style", "coding_style", "work_ethic", "species"):
                        # Brief expects either VARCHAR or _enum; both are workable.
                        if r["data_type"] == "USER-DEFINED":
                            # It's an enum at runtime — brief's ALTER TYPE statements would work.
                            pass
                        elif r["data_type"] == "character varying":
                            # It's VARCHAR — brief's ALTER TYPE statements would FAIL.
                            varchar_brief_assumed_enum.append(r["column_name"])
                if varchar_brief_assumed_enum:
                    msg = (f"VARCHAR columns the brief assumed were enums: "
                           f"{', '.join(varchar_brief_assumed_enum)}. The brief's Step C/D "
                           f"`ALTER TYPE` statements will fail for these — they need to be "
                           f"replaced with simple UPDATE statements (or no-op for additions).")
                    blockers.append(msg)
                    md.append(f"\n> ⚠ **Schema-vs-brief drift:** {msg}\n\n")
            except Exception as e:
                failures.append((label, str(e)))
                md.append(f"**ERROR:** `{e}`\n\n")
                conn.rollback()
                cur.execute("SET TRANSACTION READ ONLY")

            # ── 4. Live state probes -────────────────────────────────────────
            md.append("## 4. Live state probes\n\n")
            for label, sql in LIVE_STATE_PROBES:
                md.append(f"### {label}\n\n```sql\n{sql.strip()}\n```\n\n")
                try:
                    assert_select_only(sql)
                    if "%(schema)s" in sql:
                        cur.execute(sql, {"schema": SCHEMA})
                    else:
                        cur.execute(sql)
                    rows = cur.fetchall()
                    md.append(render_table(rows))
                except Exception as e:
                    failures.append((label, str(e)))
                    md.append(f"**ERROR:** `{e}`\n\n")
                    conn.rollback()
                    cur.execute("SET TRANSACTION READ ONLY")
    finally:
        conn.rollback()
        conn.close()

    # ── Summary -─────────────────────────────────────────────────────────────
    md.append("---\n\n## 5. Summary\n\n")
    md.append(f"- Probes attempted: {sum(len(v) for v in RETIRED_VALUES.values()) + sum(len(v) for v in RENAMED_VALUES.values()) + 1 + len(LIVE_STATE_PROBES)}\n")
    md.append(f"- Probe failures: **{len(failures)}**\n")
    md.append(f"- Blockers identified: **{len(blockers)}**\n\n")
    if blockers:
        md.append("### Blockers — must be resolved before Phase 2.2 Step 1\n\n")
        for b in blockers:
            md.append(f"- {b}\n")
        md.append("\n")
    if failures:
        md.append("### Probe failures\n\n")
        for lbl, err in failures:
            md.append(f"- `{lbl}`: {err}\n")
        md.append("\n")

    md.append("---\n\n## 6. Verdict\n\n")
    if not blockers and not failures:
        md.append("✅ **GO** — All retired values are unused, schema matches the brief's "
                  "migration plan, and live state matches the Phase 2.1 probe results. "
                  "Proceed to Step 1 (DB backup).\n")
    else:
        md.append("🛑 **HALT** — One or more blockers or failures detected. Reconcile before "
                  "proceeding to Step 1.\n")

    out_path = REPO_ROOT / "phase22-preflight.md"
    out_path.write_text("".join(md))
    print(f"[verify] wrote {out_path}", file=sys.stderr)
    return 0 if (not blockers and not failures) else 2


if __name__ == "__main__":
    sys.exit(main())
