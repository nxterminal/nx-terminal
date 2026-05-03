"""
Phase 2.2 Step 5 + 5b — align minted Devs to canonical, then lock down values.

For every row in nx.devs, this script overwrites the nine identity fields
with the corresponding values from nx.dev_canonical_traits (translated
to DB internal format where needed). All live engine state — energy,
mood, location, status, stats, personality_seed, balance, counters — is
preserved. Then it applies four CHECK constraints that lock the value
sets going forward.

Sequence:

  1. Pre-flight: pull nx.devs.token_id list and confirm every minted Dev
     has a canonical row. Halt if any missing.
  2. BEGIN transaction. UPDATE all 163 rows. Run the no-leftover
     verification query. If any non-canonical value remains, ROLLBACK
     and halt — that's a bug we need to find before retrying.
  3. COMMIT.
  4. (Step 5b) Apply four CHECK constraints in a separate transaction
     each. ALTER TABLE with VALIDATE will reject if any row violates,
     so this also serves as the safety gate that confirms alignment
     was complete.
  5. Generate `phase22-alignment-report.md` with five BEFORE/AFTER diffs
     (token #29572 always included, plus four randomly-selected others),
     updated distribution counts, and constraint-application status.

Idempotent. Can be re-run after partial failures.

Usage:
    DATABASE_URL=postgresql://user:pass@host:port/dbname \\
        python backend/scripts/align_existing_devs.py [--dry-run] [--skip-constraints]

Flags:
    --dry-run           Read everything, report what would change, write
                        nothing. Useful before the real run.
    --skip-constraints  Run Step 5 alignment but skip Step 5b. Defers
                        the CHECK-constraint safety gate.

Exit codes:
    0  Alignment + constraints succeeded; report written.
    1  Connection/environment error; nothing changed.
    2  Pre-flight failed (missing canonical rows); nothing changed.
    3  Verification query found leftover non-canonical values; alignment
       transaction was rolled back.
    4  CHECK constraint(s) failed to apply (rolled back). Report still
       written so the human can inspect.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.canonical.translation import (  # noqa: E402
    ARCHETYPE_FROM_BUNDLE,
    CANONICAL_CODING_STYLE,
    CANONICAL_SOCIAL_STYLE,
    CANONICAL_SPECIES,
    CANONICAL_WORK_ETHIC,
    CORPORATION_FROM_BUNDLE,
    RARITY_FROM_BUNDLE,
)

SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")

# Diff fields displayed in the BEFORE/AFTER samples in the report.
DIFF_FIELDS = (
    "species",
    "archetype",
    "corporation",
    "rarity_tier",
    "alignment",
    "risk_level",
    "social_style",
    "coding_style",
    "work_ethic",
)

# CHECK constraints applied in Step 5b. These mirror the value sets in
# backend/services/canonical/translation.py CANONICAL_*. Adding a new
# value to a CANONICAL_* set requires DROP CONSTRAINT + new ADD
# CONSTRAINT (or relax to NULL).
CHECK_CONSTRAINTS: list[tuple[str, str, frozenset[str]]] = [
    ("species_values",      "species",      CANONICAL_SPECIES),
    ("social_style_values", "social_style", CANONICAL_SOCIAL_STYLE),
    ("coding_style_values", "coding_style", CANONICAL_CODING_STYLE),
    ("work_ethic_values",   "work_ethic",   CANONICAL_WORK_ETHIC),
]

# Verification: zero rows must match. Used twice — once before constraints
# (Step 5 verify), once in the report's distribution section (informational).
LEFTOVER_QUERY = f"""
SELECT 'species'      AS column_name, species      AS value, COUNT(*) AS n
  FROM {SCHEMA}.devs
 WHERE species NOT IN ('Bunny','Zombie','Robot','Ghost')
 GROUP BY species
UNION ALL
SELECT 'social_style', social_style, COUNT(*)
  FROM {SCHEMA}.devs
 WHERE social_style NOT IN ('Quiet','Social','Loud','Influencer','Silent')
 GROUP BY social_style
UNION ALL
SELECT 'coding_style', coding_style, COUNT(*)
  FROM {SCHEMA}.devs
 WHERE coding_style NOT IN
       ('Chaotic','Methodical','Minimalist','Over-Engineer','Perfectionist','Speedrun')
 GROUP BY coding_style
UNION ALL
SELECT 'work_ethic', work_ethic, COUNT(*)
  FROM {SCHEMA}.devs
 WHERE work_ethic NOT IN ('Casual','Dedicated','Lazy','Obsessed')
 GROUP BY work_ethic
"""


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


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


def build_update_args(token_id: int, canonical: dict) -> tuple:
    """Translate canonical (bundle-format) → DB internal format and pack
    into the positional tuple the UPDATE expects."""
    return (
        canonical["species"],                                 # passthrough
        ARCHETYPE_FROM_BUNDLE[canonical["archetype"]],        # Title Case → UPPER_SNAKE
        CORPORATION_FROM_BUNDLE[canonical["corporation"]],    # Proper Case → UPPER_SNAKE
        RARITY_FROM_BUNDLE[canonical["rarity"]],              # Title Case → lowercase
        canonical["alignment"],                               # passthrough
        canonical["risk_level"],
        canonical["social_style"],
        canonical["coding_style"],
        canonical["work_ethic"],
        token_id,
    )


UPDATE_SQL = f"""
UPDATE {SCHEMA}.devs
   SET species       = %s,
       archetype     = %s,
       corporation   = %s,
       rarity_tier   = %s,
       alignment     = %s,
       risk_level    = %s,
       social_style  = %s,
       coding_style  = %s,
       work_ethic    = %s,
       updated_at    = NOW()
 WHERE token_id = %s
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Plan the alignment, write nothing, still emit the report.")
    ap.add_argument("--skip-constraints", action="store_true",
                    help="Run Step 5 alignment but skip Step 5b CHECK constraints.")
    args = ap.parse_args()

    params = get_connection_params()
    if not params:
        _log("[align] ERROR: no DATABASE_URL or NX_DB_HOST in environment.")
        return 1
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        _log("[align] ERROR: psycopg2 not installed. pip install psycopg2-binary first.")
        return 1

    started_at = datetime.now(timezone.utc).isoformat()
    _log(f"[align] connecting host={params['host']} db={params['dbname']} "
         f"user={params['user']} dry_run={args.dry_run} "
         f"skip_constraints={args.skip_constraints}")
    try:
        conn = psycopg2.connect(connect_timeout=10, **params)
    except Exception as e:
        _log(f"[align] ERROR: connection failed: {e}")
        return 1
    conn.autocommit = False

    md: list[str] = []
    md.append("# Phase 2.2 — alignment report (Step 5 + Step 5b)\n\n")
    md.append(f"**Branch:** `claude/refactor-metadata-api-J1jMg`  \n")
    md.append(f"**Run at (UTC):** `{started_at}`  \n")
    md.append(f"**Host:** `{params['host']}`  \n")
    md.append(f"**DB:** `{params['dbname']}`  \n")
    md.append(f"**Schema:** `{SCHEMA}`  \n")
    md.append(f"**Mode:** {'DRY RUN — no writes' if args.dry_run else 'EXECUTE'}\n\n")
    md.append("---\n\n")

    exit_code = 0

    try:
        # ── Pre-flight: pull all minted Devs and their canonical rows ─────
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM {SCHEMA}.devs")
            total_minted = cur.fetchone()["n"]
            cur.execute(
                f"SELECT d.token_id, "
                f"       d.species AS before_species, "
                f"       d.archetype::text AS before_archetype, "
                f"       d.corporation::text AS before_corporation, "
                f"       d.rarity_tier::text AS before_rarity_tier, "
                f"       d.alignment AS before_alignment, "
                f"       d.risk_level AS before_risk_level, "
                f"       d.social_style AS before_social_style, "
                f"       d.coding_style AS before_coding_style, "
                f"       d.work_ethic AS before_work_ethic, "
                f"       c.species AS c_species, c.archetype AS c_archetype, "
                f"       c.corporation AS c_corporation, c.rarity AS c_rarity, "
                f"       c.alignment AS c_alignment, c.risk_level AS c_risk_level, "
                f"       c.social_style AS c_social_style, "
                f"       c.coding_style AS c_coding_style, "
                f"       c.work_ethic AS c_work_ethic "
                f"  FROM {SCHEMA}.devs d "
                f"  LEFT JOIN {SCHEMA}.dev_canonical_traits c USING (token_id) "
                f"  ORDER BY d.token_id"
            )
            joined = [dict(r) for r in cur.fetchall()]
            conn.rollback()

        missing = [r["token_id"] for r in joined if r["c_species"] is None]
        md.append("## 1. Pre-flight\n\n")
        md.append(f"- Total minted Devs in `nx.devs`: **{total_minted}**\n")
        md.append(f"- Missing canonical rows: **{len(missing)}**\n")
        if missing:
            md.append(f"- First 20 missing token_ids: {missing[:20]}\n\n")
            md.append("🛑 **HALT** — every minted Dev must have a canonical row before "
                      "alignment can run. Re-run `ingest_canonical_traits.py` first.\n")
            (REPO_ROOT / "phase22-alignment-report.md").write_text("".join(md))
            return 2
        md.append("- ✅ All minted Devs have canonical rows. Proceed.\n\n")

        # Pre-build the (token_id, args) list and the BEFORE snapshots.
        sample_token_ids = _pick_sample_token_ids([r["token_id"] for r in joined])
        before_rows_by_id = {r["token_id"]: r for r in joined}

        plan: list[tuple[int, tuple]] = []
        for r in joined:
            try:
                args_tuple = build_update_args(r["token_id"], {
                    "species": r["c_species"],
                    "archetype": r["c_archetype"],
                    "corporation": r["c_corporation"],
                    "rarity": r["c_rarity"],
                    "alignment": r["c_alignment"],
                    "risk_level": r["c_risk_level"],
                    "social_style": r["c_social_style"],
                    "coding_style": r["c_coding_style"],
                    "work_ethic": r["c_work_ethic"],
                })
                plan.append((r["token_id"], args_tuple))
            except KeyError as e:
                md.append(f"🛑 **HALT** — token {r['token_id']} canonical row contains "
                          f"a value with no internal-format mapping: `{e}`. Investigate.\n")
                conn.close()
                (REPO_ROOT / "phase22-alignment-report.md").write_text("".join(md))
                return 2

        # ── Step 5: apply alignment in one transaction ─────────────────────
        md.append("## 2. Step 5 — alignment UPDATE\n\n")
        rows_updated = 0
        leftover: list[dict] = []
        if args.dry_run:
            md.append(f"- DRY RUN: would update **{len(plan)}** rows in `{SCHEMA}.devs`.\n")
            rows_updated = len(plan)
        else:
            try:
                with conn.cursor() as cur:
                    psycopg2.extras.execute_batch(cur, UPDATE_SQL,
                                                  [args_tuple for _, args_tuple in plan],
                                                  page_size=200)
                    rows_updated = len(plan)
                    # Leftover-value verification, still inside the transaction.
                    cur.execute(LEFTOVER_QUERY)
                    leftover = [dict(r) for r in cur.fetchall()]
                if leftover:
                    md.append(f"🛑 **HALT** — leftover non-canonical values remain "
                              f"after UPDATE. Rolling back.\n\n")
                    md.append(render_table(leftover))
                    conn.rollback()
                    (REPO_ROOT / "phase22-alignment-report.md").write_text("".join(md))
                    return 3
                conn.commit()
                md.append(f"- ✅ {rows_updated} rows updated; verification query "
                          f"returned 0 leftover values. Transaction committed.\n\n")
            except Exception as e:
                conn.rollback()
                md.append(f"🛑 **HALT** — UPDATE failed: `{e}`. Transaction rolled back.\n")
                conn.close()
                (REPO_ROOT / "phase22-alignment-report.md").write_text("".join(md))
                return 3

        # ── Step 5b: CHECK constraints ─────────────────────────────────────
        md.append("## 3. Step 5b — CHECK constraints\n\n")
        constraint_rows: list[dict] = []
        if args.skip_constraints:
            md.append("- ⏭ Skipped via --skip-constraints flag.\n\n")
        elif args.dry_run:
            md.append("- DRY RUN: would attempt 4 ALTER TABLE ADD CONSTRAINT statements.\n\n")
            for name, col, vals in CHECK_CONSTRAINTS:
                constraint_rows.append({
                    "constraint": name,
                    "column": col,
                    "allowed_values": ", ".join(sorted(vals)),
                    "result": "(dry run)",
                })
        else:
            for name, col, vals in CHECK_CONSTRAINTS:
                values_in_clause = ", ".join(f"'{v}'" for v in sorted(vals))
                ddl = (f"ALTER TABLE {SCHEMA}.devs ADD CONSTRAINT {name} "
                       f"CHECK ({col} IS NULL OR {col} IN ({values_in_clause}))")
                try:
                    with conn.cursor() as cur:
                        cur.execute(ddl)
                    conn.commit()
                    result = "✅ applied"
                except psycopg2.errors.DuplicateObject:  # type: ignore[attr-defined]
                    conn.rollback()
                    result = "✅ already present"
                except Exception as e:
                    conn.rollback()
                    result = f"❌ FAILED: {e}"
                    exit_code = 4
                constraint_rows.append({
                    "constraint": name,
                    "column": col,
                    "allowed_values": ", ".join(sorted(vals)),
                    "result": result,
                })
            md.append(render_table(constraint_rows))

        # ── BEFORE / AFTER samples ─────────────────────────────────────────
        md.append("## 4. BEFORE / AFTER samples\n\n")
        md.append(f"Sample size: **{len(sample_token_ids)}** tokens (always includes #29572).\n\n")
        # Re-fetch AFTER state in a fresh read-only transaction.
        after_by_id: dict[int, dict] = {}
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute(
                    f"SELECT token_id, species, archetype::text AS archetype, "
                    f"       corporation::text AS corporation, "
                    f"       rarity_tier::text AS rarity_tier, "
                    f"       alignment, risk_level, social_style, coding_style, work_ethic "
                    f"  FROM {SCHEMA}.devs "
                    f" WHERE token_id = ANY(%s)",
                    (sample_token_ids,),
                )
                for r in cur.fetchall():
                    after_by_id[r["token_id"]] = dict(r)
                conn.rollback()
        except Exception as e:
            md.append(f"_(could not re-fetch AFTER values: {e})_\n\n")

        for tid in sample_token_ids:
            before = before_rows_by_id.get(tid, {})
            after = after_by_id.get(tid, {})
            md.append(f"### Token #{tid}\n\n")
            md.append("| Field | Before | After | Changed |\n|---|---|---|---|\n")
            for f in DIFF_FIELDS:
                b = before.get(f"before_{f}")
                a = after.get(f)
                changed = "✅" if str(b) != str(a) else "—"
                md.append(f"| {f} | `{b}` | `{a}` | {changed} |\n")
            md.append("\n")

        # ── Distribution counts ────────────────────────────────────────────
        md.append("## 5. Distribution counts (post-alignment)\n\n")
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                for col in ("species", "archetype", "corporation",
                            "social_style", "coding_style", "work_ethic"):
                    cur.execute(
                        f"SELECT {col}::text AS value, COUNT(*) AS n "
                        f"FROM {SCHEMA}.devs GROUP BY {col} ORDER BY n DESC"
                    )
                    rows = [dict(r) for r in cur.fetchall()]
                    md.append(f"### {col}\n\n")
                    md.append(render_table(rows))
                conn.rollback()
        except Exception as e:
            md.append(f"_(could not fetch distribution counts: {e})_\n\n")

        # ── Anomalies ──────────────────────────────────────────────────────
        md.append("## 6. Anomalies / warnings\n\n")
        anomalies: list[str] = []
        if args.dry_run:
            anomalies.append("dry-run mode — no writes performed.")
        if args.skip_constraints:
            anomalies.append("--skip-constraints — Step 5b CHECK constraints not applied.")
        if exit_code == 4:
            anomalies.append("one or more CHECK constraints failed to apply (see §3).")
        if not anomalies:
            md.append("None.\n\n")
        else:
            for a in anomalies:
                md.append(f"- {a}\n")
            md.append("\n")

        md.append("---\n\n## 7. Verdict\n\n")
        if args.dry_run:
            md.append("🟡 **DRY RUN** — no rows were modified. Re-run without `--dry-run` "
                      "to perform the alignment.\n")
        elif exit_code == 0:
            md.append("✅ **GO for Checkpoint 3 review.** Alignment succeeded, "
                      "verification returned zero leftover values, and all 4 CHECK "
                      "constraints applied. Halt for human approval before Step 6.\n")
        elif exit_code == 4:
            md.append("🛑 **HALT** — alignment succeeded but at least one CHECK "
                      "constraint failed to apply. See §3 for the failure detail. "
                      "Investigate before proceeding to Step 6.\n")
    finally:
        try:
            conn.close()
        except Exception:
            pass

    out_path = REPO_ROOT / "phase22-alignment-report.md"
    out_path.write_text("".join(md))
    _log(f"[align] wrote {out_path}")
    return exit_code


def _pick_sample_token_ids(all_ids: list[int]) -> list[int]:
    """Token #29572 is always included per the brief; the other four are
    drawn deterministically (seed=29572) so re-runs of the script produce
    the same samples in the report."""
    rng = random.Random(29572)
    candidates = [i for i in all_ids if i != 29572]
    rng.shuffle(candidates)
    extras = candidates[:4]
    if 29572 in all_ids:
        return sorted([29572] + extras)
    return sorted(extras + [candidates[4]] if len(candidates) > 4 else candidates[:5])


if __name__ == "__main__":
    sys.exit(main())
