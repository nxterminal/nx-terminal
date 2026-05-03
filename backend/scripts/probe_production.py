"""
Phase 2.1 — Read-only production probe.

Connects to the production Postgres using the standard env-var conventions
(`DATABASE_URL` *or* `NX_DB_HOST`/`PORT`/`NAME`/`USER`/`PASS`), runs the
SELECT queries listed in the Phase 2.1 brief, and writes a side-by-side
comparison report to `phase2-probe-results.md` at the repo root.

Safety guarantees (defense in depth):

  1. Connection is opened with autocommit=False so the entire session
     runs inside one transaction.
  2. The session executes `SET TRANSACTION READ ONLY` immediately after
     connect — Postgres rejects any DML/DDL in this mode.
  3. Every query is statically validated to start with `SELECT` (case
     insensitive) before execution. Anything else aborts.
  4. The transaction is rolled back at the end of the script even
     though no writes are possible. Belt + suspenders.
  5. There is no `cur.execute(some_user_input)` — the queries are
     literal constants.

Usage:
    DATABASE_URL=... python backend/scripts/probe_production.py
    # or
    NX_DB_HOST=... NX_DB_USER=... NX_DB_PASS=... NX_DB_NAME=... \
        python backend/scripts/probe_production.py

Exit codes:
    0  - all probes ran successfully, report written
    1  - DB connection failed
    2  - one or more queries failed (report still written with partial data)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")
BUNDLE_BASE = "https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/"

# ── Probe definitions -─────────────────────────────────────────────────────
# Each entry: (label, sql). Every sql MUST start with SELECT (case-insensitive).
PROBES: list[tuple[str, str]] = [
    (
        "A. Energy / max_energy range",
        f"""
        SELECT MIN(energy) AS energy_min, MAX(energy) AS energy_max,
               AVG(energy)::numeric(5,1) AS energy_avg,
               MIN(max_energy) AS max_energy_min, MAX(max_energy) AS max_energy_max,
               COUNT(*) FILTER (WHERE energy > 15) AS rows_with_energy_gt_15
          FROM {SCHEMA}.devs
        """,
    ),
    (
        "B. Species distribution",
        f"SELECT species, COUNT(*) AS n FROM {SCHEMA}.devs GROUP BY species ORDER BY n DESC",
    ),
    (
        "C. Archetype distribution",
        f"SELECT archetype::text AS archetype, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY archetype ORDER BY n DESC",
    ),
    (
        "D. Corporation distribution",
        f"SELECT corporation::text AS corporation, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY corporation ORDER BY n DESC",
    ),
    (
        "E. Rarity distribution",
        f"SELECT rarity_tier::text AS rarity, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY rarity_tier ORDER BY n DESC",
    ),
    (
        "F. Alignment distribution",
        f"SELECT alignment, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY alignment ORDER BY n DESC",
    ),
    (
        "G. Risk Level distribution",
        f"SELECT risk_level, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY risk_level ORDER BY n DESC",
    ),
    (
        "H. Social Style distribution",
        f"SELECT social_style, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY social_style ORDER BY n DESC",
    ),
    (
        "I. Coding Style distribution",
        f"SELECT coding_style, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY coding_style ORDER BY n DESC",
    ),
    (
        "J. Work Ethic distribution",
        f"SELECT work_ethic, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY work_ethic ORDER BY n DESC",
    ),
    (
        "K. Location distribution (watch for 'GitHub HQ')",
        f"SELECT location::text AS location, COUNT(*) AS n FROM {SCHEMA}.devs "
        f"GROUP BY location ORDER BY n DESC",
    ),
    (
        "L. dev_status_enum value list",
        f"SELECT unnest(enum_range(NULL::{SCHEMA}.dev_status_enum))::text AS status_value",
    ),
    (
        "M. devs_burned / energy / max_energy column existence",
        "SELECT column_name, data_type, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_schema = %(schema)s AND table_name = 'devs' "
        "  AND column_name IN ('devs_burned','energy','max_energy','personality_seed','bugs_fixed') "
        "ORDER BY column_name",
    ),
    (
        "N. Stat min/max",
        f"""
        SELECT MIN(stat_coding) AS coding_min, MAX(stat_coding) AS coding_max,
               MIN(stat_hacking) AS hacking_min, MAX(stat_hacking) AS hacking_max,
               MIN(stat_trading) AS trading_min, MAX(stat_trading) AS trading_max,
               MIN(stat_social) AS social_min, MAX(stat_social) AS social_max,
               MIN(stat_endurance) AS endurance_min, MAX(stat_endurance) AS endurance_max,
               MIN(stat_luck) AS luck_min, MAX(stat_luck) AS luck_max,
               COUNT(*) FILTER (WHERE stat_coding < 15
                              OR stat_hacking < 15
                              OR stat_trading < 15
                              OR stat_social < 15
                              OR stat_endurance < 15
                              OR stat_luck < 15) AS rows_with_any_stat_below_15
          FROM {SCHEMA}.devs
        """,
    ),
    (
        "O. personality_seed health",
        f"""
        SELECT COUNT(*) FILTER (WHERE personality_seed IS NULL OR personality_seed = 0) AS bad_seeds,
               MIN(personality_seed) AS min_seed,
               MAX(personality_seed) AS max_seed,
               COUNT(DISTINCT personality_seed) AS distinct_seeds,
               COUNT(*) AS total_devs
          FROM {SCHEMA}.devs
        """,
    ),
    (
        "P. End-to-end token row dump (1, 100, 1337, 29572, 35000)",
        f"""
        SELECT token_id, name, species, archetype::text AS archetype,
               corporation::text AS corporation, rarity_tier::text AS rarity_tier,
               alignment, risk_level, social_style, coding_style, work_ethic,
               stat_coding, stat_hacking, stat_trading, stat_social,
               stat_endurance, stat_luck,
               energy, max_energy, mood::text AS mood, location::text AS location,
               status::text AS status, personality_seed
          FROM {SCHEMA}.devs
         WHERE token_id IN (1, 100, 1337, 29572, 35000)
         ORDER BY token_id
        """,
    ),
    (
        "Q. Total dev count",
        f"SELECT COUNT(*) AS total_devs FROM {SCHEMA}.devs",
    ),
]

# ── Connection -────────────────────────────────────────────────────────────


def get_connection_params() -> dict[str, Any] | None:
    """Mirror the parsing logic in backend/api/deps.py."""
    if "DATABASE_URL" in os.environ and os.environ["DATABASE_URL"]:
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
    if "NX_DB_HOST" in os.environ:
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
    """Static validation: SQL must begin with SELECT (modulo whitespace/comments)."""
    stripped = sql.strip()
    # Skip leading comments
    while stripped.startswith("--"):
        nl = stripped.find("\n")
        if nl == -1:
            break
        stripped = stripped[nl + 1 :].lstrip()
    if not stripped.upper().startswith("SELECT"):
        raise AssertionError(f"Refusing to run non-SELECT query: {sql[:60]!r}")


def fetch_bundle(token_id: int) -> dict | None:
    try:
        with urllib.request.urlopen(f"{BUNDLE_BASE}{token_id}.json", timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, ValueError):
        return None


# ── Markdown emit -─────────────────────────────────────────────────────────


def render_table(rows: list[dict] | list[tuple], cols: list[str] | None = None) -> str:
    if not rows:
        return "_(no rows)_\n"
    if isinstance(rows[0], dict):
        cols = cols or list(rows[0].keys())
        out = "| " + " | ".join(cols) + " |\n"
        out += "|" + "|".join(["---"] * len(cols)) + "|\n"
        for r in rows:
            out += "| " + " | ".join(_fmt_cell(r.get(c)) for c in cols) + " |\n"
        return out
    # tuples
    cols = cols or [f"col{i}" for i in range(len(rows[0]))]
    out = "| " + " | ".join(cols) + " |\n"
    out += "|" + "|".join(["---"] * len(cols)) + "|\n"
    for r in rows:
        out += "| " + " | ".join(_fmt_cell(c) for c in r) + " |\n"
    return out


def _fmt_cell(v: Any) -> str:
    if v is None:
        return "_NULL_"
    s = str(v)
    return s.replace("|", "\\|").replace("\n", " ")


# ── Main -──────────────────────────────────────────────────────────────────


def main() -> int:
    params = get_connection_params()
    if not params:
        print("[probe] ERROR: no DATABASE_URL or NX_DB_HOST in environment.", file=sys.stderr)
        print("[probe] Set DATABASE_URL=postgresql://user:pass@host:port/dbname and re-run.",
              file=sys.stderr)
        return 1

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("[probe] ERROR: psycopg2 is not installed. "
              "Run `pip install psycopg2-binary` first.", file=sys.stderr)
        return 1

    print(f"[probe] connecting host={params['host']} db={params['dbname']} "
          f"user={params['user']} sslmode={params['sslmode']}", file=sys.stderr)

    try:
        conn = psycopg2.connect(connect_timeout=10, **params)
    except Exception as e:
        print(f"[probe] ERROR: connection failed: {e}", file=sys.stderr)
        return 1

    conn.autocommit = False
    started_at = datetime.now(timezone.utc).isoformat()

    md: list[str] = []
    md.append("# Phase 2.1 — Production probe results\n\n")
    md.append(f"**Branch:** `claude/refactor-metadata-api-J1jMg`  \n")
    md.append(f"**Run at (UTC):** `{started_at}`  \n")
    md.append(f"**Host:** `{params['host']}`  \n")
    md.append(f"**DB:** `{params['dbname']}`  \n")
    md.append(f"**Schema:** `{SCHEMA}`  \n")
    md.append(f"**Mode:** read-only (transaction `READ ONLY`, all SQL statically gated to SELECT).\n\n")
    md.append("---\n\n")

    failures: list[tuple[str, str]] = []

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Lock the session to read-only mode at the Postgres layer.
            cur.execute("SET TRANSACTION READ ONLY")
            print("[probe] session set to READ ONLY", file=sys.stderr)

            for label, sql in PROBES:
                print(f"[probe] {label}", file=sys.stderr)
                md.append(f"## {label}\n\n")
                md.append("```sql\n" + sql.strip() + "\n```\n\n")
                try:
                    assert_select_only(sql)
                    if "%(schema)s" in sql:
                        cur.execute(sql, {"schema": SCHEMA})
                    else:
                        cur.execute(sql)
                    rows = cur.fetchall()
                    md.append(f"**Rows returned:** {len(rows)}\n\n")
                    md.append(render_table(rows))
                    md.append("\n")
                except Exception as e:
                    failures.append((label, str(e)))
                    md.append(f"**ERROR:** `{e}`\n\n")
                    # Postgres aborts the transaction on error; rollback to clear state
                    conn.rollback()
                    cur.execute("SET TRANSACTION READ ONLY")
    finally:
        conn.rollback()
        conn.close()

    # ── End-to-end token diff (token in (1,100,1337,29572,35000)) -─────────
    md.append("---\n\n## R. Token-by-token diff: bundle vs nx.devs\n\n")
    md.append("For each sample token, the bundle's identity values are listed alongside the "
              "production `nx.devs` row. Drift here is expected — that's what Phase 2 fixes.\n\n")

    p_rows_label = "P. End-to-end token row dump (1, 100, 1337, 29572, 35000)"
    db_rows_by_id: dict[int, dict] = {}
    for label, sql in PROBES:
        if label == p_rows_label:
            break
    # Re-fetch P's results from md content is awkward — store separately
    # Re-execute is forbidden after rollback close; we already saved in md.
    # Instead we open a tiny new connection for the diff section.
    try:
        conn2 = psycopg2.connect(connect_timeout=10, **params)
        conn2.autocommit = False
        with conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(
                f"SELECT token_id, name, species, archetype::text AS archetype, "
                f"  corporation::text AS corporation, rarity_tier::text AS rarity_tier, "
                f"  alignment, risk_level, social_style, coding_style, work_ethic, "
                f"  stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck, "
                f"  energy, max_energy, mood::text AS mood, location::text AS location, "
                f"  status::text AS status, personality_seed "
                f"FROM {SCHEMA}.devs WHERE token_id IN (1,100,1337,29572,35000) ORDER BY token_id"
            )
            for r in cur.fetchall():
                db_rows_by_id[r["token_id"]] = dict(r)
        conn2.rollback()
        conn2.close()
    except Exception as e:
        md.append(f"_diff fetch failed: {e}_\n\n")

    DIFF_KEYS = [
        ("Species", "species"),
        ("Archetype", "archetype"),
        ("Corporation", "corporation"),
        ("Rarity", "rarity_tier"),
        ("Alignment", "alignment"),
        ("Risk Level", "risk_level"),
        ("Social Style", "social_style"),
        ("Coding Style", "coding_style"),
        ("Work Ethic", "work_ethic"),
        ("Coding", "stat_coding"),
        ("Hacking", "stat_hacking"),
        ("Trading", "stat_trading"),
        ("Social", "stat_social"),
        ("Endurance", "stat_endurance"),
        ("Luck", "stat_luck"),
        ("Energy", "energy"),
    ]
    for tid in (1, 100, 1337, 29572, 35000):
        md.append(f"### Token {tid}\n\n")
        bundle = fetch_bundle(tid)
        db = db_rows_by_id.get(tid)
        if not bundle:
            md.append("_bundle fetch failed_\n\n")
        if not db:
            md.append("_no DB row_\n\n")
        if not bundle or not db:
            continue
        bundle_attrs = {a["trait_type"]: a["value"] for a in bundle.get("attributes", [])}
        md.append("| Trait | Bundle | nx.devs | Match |\n|---|---|---|---|\n")
        for label, db_key in DIFF_KEYS:
            b = bundle_attrs.get(label)
            d = db.get(db_key)
            match = "✅" if str(b) == str(d) else "❌"
            md.append(f"| {label} | `{b}` | `{d}` | {match} |\n")
        md.append("\n")

    # ── Footer -────────────────────────────────────────────────────────────
    md.append("---\n\n## Summary\n\n")
    md.append(f"- Probes run: **{len(PROBES) - len(failures)} / {len(PROBES)}** successful\n")
    if failures:
        md.append(f"- **Failures: {len(failures)}**\n\n")
        for lbl, err in failures:
            md.append(f"  - `{lbl}`: {err}\n")
    md.append("\n🛑 Halt for human review.\n")

    out_path = REPO_ROOT / "phase2-probe-results.md"
    out_path.write_text("".join(md))
    print(f"[probe] wrote {out_path}", file=sys.stderr)
    return 2 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
