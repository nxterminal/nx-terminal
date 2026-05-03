"""
Phase 2.2 Step 4 — bundle ingest into nx.dev_canonical_traits.

Fetches all 35,000 canonical metadata JSONs from
    https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/{N}.json
and upserts each one into nx.dev_canonical_traits.

Identity / visual fields come from the bundle in their native casing.
Baseline stats follow the human's Phase 2.2 decision (Option B3):

  - If a row exists in nx.devs (minted Dev), snapshot stat_coding..stat_luck
    AND personality_seed from there. The bundle's Coding/Hacking/etc.
    fields are ignored — the engine-generated stats are the truth.
  - If no row exists in nx.devs (unminted), fall back to the bundle's
    stat values, and derive the personality seed deterministically from
    the token_id so the NX Souls axes can be computed. The listener
    re-derives them from the real personality_seed at mint time.

NX Souls axes (voice_tone, quirk, lore_faction) are derived from the
seed via backend.services.nx_souls.derivation.

Idempotent. Resumable. Safe to re-run.

Usage:
    DATABASE_URL=postgresql://user:pass@host:port/dbname \\
        python backend/scripts/ingest_canonical_traits.py [--dry-run] [--start N] [--end N]

Flags:
    --dry-run     Fetch and parse, but don't write to the DB.
    --start N     Lower bound (inclusive) for token_id range. Default 1.
    --end N       Upper bound (inclusive) for token_id range. Default 35000.

Exit codes:
    0  All requested tokens ingested successfully.
    1  Connection or environment error.
    2  One or more per-token failures (full count in the final summary).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.nx_souls.derivation import derive_nx_souls_traits  # noqa: E402

BUNDLE_BASE = "https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/"
SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")
CONCURRENCY = 25
CHUNK_SIZE = 500
BUNDLE_RETRIES = 3
BUNDLE_TIMEOUT = 20

# All required bundle attribute keys. Missing any is a hard failure for
# that token; we log it and skip rather than insert garbage.
REQUIRED_KEYS = (
    "Species", "Archetype", "Corporation", "Rarity",
    "Alignment", "Risk Level", "Social Style", "Coding Style",
    "Work Ethic", "Skill Module",
    "Coding", "Hacking", "Trading", "Social", "Endurance", "Luck",
)

UPSERT_SQL = f"""
INSERT INTO {SCHEMA}.dev_canonical_traits (
    token_id,
    species, archetype, corporation, rarity,
    alignment, risk_level, social_style, coding_style, work_ethic, skill_module,
    clothing, clothing_pattern, eyewear, neckwear, spots, blush, ear_detail,
    voice_tone, quirk, lore_faction,
    stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
    bundle_source, ingested_at, updated_at
) VALUES (
    %(token_id)s,
    %(species)s, %(archetype)s, %(corporation)s, %(rarity)s,
    %(alignment)s, %(risk_level)s, %(social_style)s, %(coding_style)s, %(work_ethic)s, %(skill_module)s,
    %(clothing)s, %(clothing_pattern)s, %(eyewear)s, %(neckwear)s, %(spots)s, %(blush)s, %(ear_detail)s,
    %(voice_tone)s, %(quirk)s, %(lore_faction)s,
    %(stat_coding)s, %(stat_hacking)s, %(stat_trading)s, %(stat_social)s, %(stat_endurance)s, %(stat_luck)s,
    %(bundle_source)s, NOW(), NOW()
)
ON CONFLICT (token_id) DO UPDATE SET
    species          = EXCLUDED.species,
    archetype        = EXCLUDED.archetype,
    corporation      = EXCLUDED.corporation,
    rarity           = EXCLUDED.rarity,
    alignment        = EXCLUDED.alignment,
    risk_level       = EXCLUDED.risk_level,
    social_style     = EXCLUDED.social_style,
    coding_style     = EXCLUDED.coding_style,
    work_ethic       = EXCLUDED.work_ethic,
    skill_module     = EXCLUDED.skill_module,
    clothing         = EXCLUDED.clothing,
    clothing_pattern = EXCLUDED.clothing_pattern,
    eyewear          = EXCLUDED.eyewear,
    neckwear         = EXCLUDED.neckwear,
    spots            = EXCLUDED.spots,
    blush            = EXCLUDED.blush,
    ear_detail       = EXCLUDED.ear_detail,
    voice_tone       = EXCLUDED.voice_tone,
    quirk            = EXCLUDED.quirk,
    lore_faction     = EXCLUDED.lore_faction,
    stat_coding      = EXCLUDED.stat_coding,
    stat_hacking     = EXCLUDED.stat_hacking,
    stat_trading     = EXCLUDED.stat_trading,
    stat_social      = EXCLUDED.stat_social,
    stat_endurance   = EXCLUDED.stat_endurance,
    stat_luck        = EXCLUDED.stat_luck,
    bundle_source    = EXCLUDED.bundle_source,
    updated_at       = NOW()
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


def parse_yes_no(v: Any) -> bool | None:
    """Bundle's Blush / Ear Detail fields are 'Yes' / 'No' strings."""
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s == "yes":
        return True
    if s == "no":
        return False
    return None


def attrs_dict(bundle_json: dict) -> dict[str, Any]:
    """Convert the bundle's `attributes: [{trait_type, value}, ...]` list
    into a flat {trait_type: value} dict."""
    out: dict[str, Any] = {}
    for a in bundle_json.get("attributes") or []:
        out[a.get("trait_type")] = a.get("value")
    return out


def fetch_bundle(session: requests.Session, token_id: int) -> tuple[int, dict | None, str | None]:
    url = f"{BUNDLE_BASE}{token_id}.json"
    last_err: str | None = None
    for attempt in range(BUNDLE_RETRIES):
        try:
            r = session.get(url, timeout=BUNDLE_TIMEOUT)
            if r.status_code == 200:
                try:
                    return token_id, r.json(), None
                except ValueError as e:
                    return token_id, None, f"json decode: {e}"
            if r.status_code == 404:
                return token_id, None, "404"
            last_err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(0.5 * (attempt + 1))
    return token_id, None, last_err


def derive_unminted_seed(token_id: int) -> int:
    """Deterministic 60-bit seed for unminted Devs. The listener overwrites
    these once a real personality_seed is generated at mint time, so this
    only ever matters for unminted-Dev preview values."""
    return int(hashlib.sha256(f"unminted-{token_id}".encode("utf-8")).hexdigest()[:15], 16)


def build_canonical_row(
    token_id: int,
    bundle: dict,
    devs_row: dict | None,
    bundle_source: str,
) -> dict[str, Any]:
    a = attrs_dict(bundle)

    missing = [k for k in REQUIRED_KEYS if a.get(k) is None]
    if missing:
        raise ValueError(f"token {token_id}: missing required bundle keys: {missing}")

    # Stats: prefer nx.devs.stat_* if minted, else bundle's numeric attrs.
    if devs_row is not None:
        seed = devs_row["personality_seed"]
        stat_coding    = devs_row["stat_coding"]
        stat_hacking   = devs_row["stat_hacking"]
        stat_trading   = devs_row["stat_trading"]
        stat_social    = devs_row["stat_social"]
        stat_endurance = devs_row["stat_endurance"]
        stat_luck      = devs_row["stat_luck"]
    else:
        seed = derive_unminted_seed(token_id)
        stat_coding    = int(a["Coding"])
        stat_hacking   = int(a["Hacking"])
        stat_trading   = int(a["Trading"])
        stat_social    = int(a["Social"])
        stat_endurance = int(a["Endurance"])
        stat_luck      = int(a["Luck"])

    nx_souls = derive_nx_souls_traits(seed)

    return {
        "token_id":         token_id,
        "species":          a["Species"],
        "archetype":        a["Archetype"],
        "corporation":      a["Corporation"],
        "rarity":           a["Rarity"],
        "alignment":        a["Alignment"],
        "risk_level":       a["Risk Level"],
        "social_style":     a["Social Style"],
        "coding_style":     a["Coding Style"],
        "work_ethic":       a["Work Ethic"],
        "skill_module":     a["Skill Module"],
        "clothing":         a.get("Clothing"),
        "clothing_pattern": a.get("Clothing Pattern"),
        "eyewear":          a.get("Eyewear"),
        "neckwear":         a.get("Neckwear"),
        "spots":            a.get("Spots"),
        "blush":            parse_yes_no(a.get("Blush")),
        "ear_detail":       parse_yes_no(a.get("Ear Detail")),
        "voice_tone":       nx_souls["voice_tone"],
        "quirk":            nx_souls["quirk"],
        "lore_faction":     nx_souls["lore_faction"],
        "stat_coding":      stat_coding,
        "stat_hacking":     stat_hacking,
        "stat_trading":     stat_trading,
        "stat_social":      stat_social,
        "stat_endurance":   stat_endurance,
        "stat_luck":        stat_luck,
        "bundle_source":    bundle_source,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Fetch and parse, but don't write to the DB.")
    ap.add_argument("--start", type=int, default=1, help="Lower bound (inclusive). Default 1.")
    ap.add_argument("--end", type=int, default=35000, help="Upper bound (inclusive). Default 35000.")
    args = ap.parse_args()

    if args.start < 1 or args.end > 35000 or args.start > args.end:
        _log(f"[ingest] ERROR: invalid range {args.start}..{args.end}")
        return 1

    params = get_connection_params()
    if not params:
        _log("[ingest] ERROR: no DATABASE_URL or NX_DB_HOST in environment.")
        return 1
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        _log("[ingest] ERROR: psycopg2 not installed. pip install psycopg2-binary first.")
        return 1

    _log(f"[ingest] connecting host={params['host']} db={params['dbname']} "
         f"user={params['user']} sslmode={params['sslmode']} dry_run={args.dry_run}")
    try:
        conn = psycopg2.connect(connect_timeout=10, **params)
    except Exception as e:
        _log(f"[ingest] ERROR: connection failed: {e}")
        return 1
    conn.autocommit = False

    bundle_source = "github:nxterminal/nx-metadata-bundle@main"
    session = requests.Session()
    session.headers.update({"User-Agent": "nx-terminal-bundle-ingest/1.0"})

    # Pre-fetch all minted-Dev rows in the requested range so we don't
    # hammer the DB with 35k point queries.
    _log("[ingest] pre-loading nx.devs rows...")
    minted: dict[int, dict] = {}
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"SELECT token_id, personality_seed, "
                f"       stat_coding, stat_hacking, stat_trading, "
                f"       stat_social, stat_endurance, stat_luck "
                f"FROM {SCHEMA}.devs "
                f"WHERE token_id BETWEEN %s AND %s",
                (args.start, args.end),
            )
            for r in cur.fetchall():
                minted[r["token_id"]] = dict(r)
            conn.rollback()
    except Exception as e:
        _log(f"[ingest] ERROR: failed to pre-load nx.devs: {e}")
        conn.close()
        return 1
    _log(f"[ingest] {len(minted)} minted Devs in range [{args.start}, {args.end}]")

    ids = list(range(args.start, args.end + 1))
    chunks = [ids[i : i + CHUNK_SIZE] for i in range(0, len(ids), CHUNK_SIZE)]

    upserted = 0
    failed: list[tuple[int, str]] = []
    started = time.time()

    try:
        for ci, chunk in enumerate(chunks, 1):
            chunk_t0 = time.time()
            # Fetch bundle JSONs for this chunk in parallel
            results: list[tuple[int, dict | None, str | None]] = []
            with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
                futures = [pool.submit(fetch_bundle, session, tid) for tid in chunk]
                for f in as_completed(futures):
                    results.append(f.result())

            # Build rows + execute upserts within a single transaction.
            rows_to_upsert: list[dict[str, Any]] = []
            for token_id, bundle, err in results:
                if err or not bundle:
                    failed.append((token_id, err or "no data"))
                    continue
                try:
                    row = build_canonical_row(
                        token_id, bundle, minted.get(token_id), bundle_source
                    )
                    rows_to_upsert.append(row)
                except Exception as e:
                    failed.append((token_id, f"build: {e}"))

            if rows_to_upsert and not args.dry_run:
                try:
                    with conn.cursor() as cur:
                        psycopg2.extras.execute_batch(cur, UPSERT_SQL, rows_to_upsert, page_size=200)
                    conn.commit()
                    upserted += len(rows_to_upsert)
                except Exception as e:
                    conn.rollback()
                    _log(f"[ingest] chunk {ci} write failed, falling back to per-row: {e}")
                    # Per-row fallback to localise bad rows.
                    for r in rows_to_upsert:
                        try:
                            with conn.cursor() as cur:
                                cur.execute(UPSERT_SQL, r)
                            conn.commit()
                            upserted += 1
                        except Exception as e2:
                            conn.rollback()
                            failed.append((r["token_id"], f"upsert: {e2}"))
            elif rows_to_upsert and args.dry_run:
                upserted += len(rows_to_upsert)

            elapsed = time.time() - started
            rate = (ci * CHUNK_SIZE) / elapsed if elapsed else 0
            eta = (len(chunks) - ci) * CHUNK_SIZE / rate if rate else 0
            _log(f"[ingest]   chunk {ci}/{len(chunks)} "
                 f"({(ci - 1) * CHUNK_SIZE + len(chunk)}/{len(ids)}) "
                 f"{time.time() - chunk_t0:.1f}s — upserted: {upserted}, failed: {len(failed)}, "
                 f"ETA {eta:.0f}s")
    finally:
        try:
            conn.close()
        except Exception:
            pass

    elapsed = time.time() - started
    _log(f"[ingest] done in {elapsed:.1f}s")
    _log(f"[ingest]   upserted: {upserted}")
    _log(f"[ingest]   failed:   {len(failed)}")
    if failed:
        _log("[ingest] first 20 failures:")
        for tid, err in failed[:20]:
            _log(f"  - {tid}: {err}")
        # Persist full failures list for follow-up.
        out = REPO_ROOT / "phase22-ingest-failures.json"
        out.write_text(json.dumps(failed, indent=2))
        _log(f"[ingest] full failure list written to {out}")
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
