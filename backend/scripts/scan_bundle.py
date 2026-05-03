"""
Phase 2.1 — Full canonical-bundle scan.

Fetches all 35,000 metadata JSONs from
    https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/{N}.json
aggregates per-trait distinct values + counts, and writes:

  - phase2-bundle-scan.md          (human-readable report)
  - phase2-bundle-value-sets.json  (machine-readable, used by ingest)

Read-only over the network. Idempotent. Safe to re-run.

Usage:
    python backend/scripts/scan_bundle.py
"""

from __future__ import annotations

import json
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BUNDLE_BASE = "https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/"
TOKEN_RANGE = range(1, 35_001)
CONCURRENCY = 25
CHUNK_SIZE = 500
RETRIES = 3
TIMEOUT = 20

REPO_ROOT = Path(__file__).resolve().parents[2]

EXPECTED_VALUE_SETS = {
    "Species": {"Wolf", "Cat", "Owl", "Fox", "Bear", "Raven", "Snake", "Shark",
                "Monkey", "Robot", "Alien", "Ghost", "Dragon", "Human"},
    "Archetype": {"10X_DEV", "LURKER", "DEGEN", "GRINDER",
                  "INFLUENCER", "HACKTIVIST", "FED", "SCRIPT_KIDDIE"},
    "Corporation": {"CLOSED_AI", "MISANTHROPIC", "SHALLOW_MIND",
                    "ZUCK_LABS", "Y_AI", "MISTRIAL_SYSTEMS"},
    "Rarity": {"common", "uncommon", "rare", "legendary", "mythic"},
    "Alignment": {"Lawful Good", "Neutral Good", "Chaotic Good",
                  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
                  "Lawful Evil", "Neutral Evil", "Chaotic Evil"},
    "Risk Level": {"Conservative", "Moderate", "Aggressive", "Reckless"},
    "Social Style": {"Quiet", "Social", "Loud", "Troll", "Mentor"},
    "Coding Style": {"Methodical", "Chaotic", "Perfectionist", "Speed Runner", "Copy Paste"},
    "Work Ethic": {"Grinder", "Lazy", "Balanced", "Obsessed", "Steady"},
    "Skill Module": None,
    "Clothing": None,
    "Clothing Pattern": None,
    "Eyewear": None,
    "Neckwear": None,
    "Spots": None,
    "Blush": None,
    "Ear Detail": None,
    "Status": None,
    "Mood": None,
    "Location": None,
}

NUMERIC_TRAITS = {
    "Coding", "Hacking", "Trading", "Social", "Endurance", "Luck",
    "Energy", "Reputation", "Balance ($NXT)", "Day", "Coffee Count",
    "Lines of Code", "Bugs Shipped", "Hours Since Sleep",
    "Protocols Created", "Protocols Failed", "Devs Burned",
}


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def fetch_one(session: requests.Session, token_id: int) -> tuple[int, dict | None, str | None]:
    """Fetch one bundle JSON. Returns (token_id, data, error)."""
    url = f"{BUNDLE_BASE}{token_id}.json"
    last_err: str | None = None
    for attempt in range(RETRIES):
        try:
            r = session.get(url, timeout=TIMEOUT)
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


def aggregate(data: dict, agg: dict) -> None:
    attrs = data.get("attributes") or []
    seen_keys = set()
    corp_val = skill_val = None
    for a in attrs:
        t = a.get("trait_type")
        v = a.get("value")
        seen_keys.add(t)
        if t in NUMERIC_TRAITS or isinstance(v, (int, float)):
            mm = agg["numeric_minmax"].get(t)
            if mm is None:
                agg["numeric_minmax"][t] = [v, v]
            else:
                if v < mm[0]:
                    mm[0] = v
                if v > mm[1]:
                    mm[1] = v
        else:
            agg["string_values"][t][str(v)] += 1
            if t == "Corporation":
                corp_val = v
            elif t == "Skill Module":
                skill_val = v
        if t not in EXPECTED_VALUE_SETS and t not in NUMERIC_TRAITS:
            agg["extra_traits"][t] += 1
    if corp_val and skill_val:
        agg["skill_module_by_corp"][corp_val][skill_val] += 1
    expected_keys = set(EXPECTED_VALUE_SETS.keys()) | NUMERIC_TRAITS
    if not expected_keys.issubset(seen_keys):
        agg["missing_attrs_count"] += 1
    agg["attrs_per_token"].append(len(attrs))


def process_chunk(session: requests.Session, ids: list[int], agg: dict) -> int:
    fails = 0
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_one, session, tid): tid for tid in ids}
        for fut in as_completed(futures):
            tid, data, err = fut.result()
            if err or not data:
                agg["failures"].append((tid, err or "no data"))
                fails += 1
                continue
            aggregate(data, agg)
    return fails


def main() -> int:
    _log(f"[scan] fetching {len(TOKEN_RANGE)} JSONs from {BUNDLE_BASE} "
         f"(concurrency={CONCURRENCY}, chunks of {CHUNK_SIZE})")
    agg: dict = {
        "string_values": defaultdict(Counter),
        "numeric_minmax": {},
        "extra_traits": Counter(),
        "skill_module_by_corp": defaultdict(Counter),
        "missing_attrs_count": 0,
        "attrs_per_token": [],
        "failures": [],
    }

    started = time.time()
    session = requests.Session()
    session.headers.update({"User-Agent": "nx-terminal-bundle-scan/1.0"})

    ids = list(TOKEN_RANGE)
    chunks = [ids[i : i + CHUNK_SIZE] for i in range(0, len(ids), CHUNK_SIZE)]
    done = 0
    for ci, chunk in enumerate(chunks, 1):
        chunk_t0 = time.time()
        process_chunk(session, chunk, agg)
        done += len(chunk)
        elapsed = time.time() - started
        rate = done / elapsed if elapsed else 0
        eta = (len(ids) - done) / rate if rate else 0
        _log(f"[scan]   chunk {ci}/{len(chunks)} ({done}/{len(ids)}) "
             f"{time.time() - chunk_t0:.1f}s — {rate:.0f}/s, ETA {eta:.0f}s, "
             f"failures so far: {len(agg['failures'])}")

    elapsed = time.time() - started
    _log(f"[scan] done in {elapsed:.1f}s, failures: {len(agg['failures'])}")

    # ── Persist machine-readable artifacts -────────────────────────────────
    out_json = {
        "bundle_url_template": f"{BUNDLE_BASE}{{N}}.json",
        "fetched_total": len(ids) - len(agg["failures"]),
        "fetched_failed": len(agg["failures"]),
        "elapsed_seconds": round(elapsed, 1),
        "string_value_sets": {k: sorted(v.keys()) for k, v in agg["string_values"].items()},
        "string_value_counts": {k: dict(sorted(v.items(), key=lambda kv: -kv[1]))
                                for k, v in agg["string_values"].items()},
        "numeric_min_max": {k: {"min": v[0], "max": v[1]} for k, v in agg["numeric_minmax"].items()},
        "skill_module_by_corporation": {c: dict(s) for c, s in agg["skill_module_by_corp"].items()},
        "failures_sample": agg["failures"][:20],
    }
    out_path = REPO_ROOT / "phase2-bundle-value-sets.json"
    out_path.write_text(json.dumps(out_json, indent=2, sort_keys=True))
    _log(f"[scan] wrote {out_path}")

    # ── Render markdown report -────────────────────────────────────────────
    md: list[str] = []
    md.append("# Phase 2.1 — Full bundle scan results\n\n")
    md.append(f"**Branch:** `claude/refactor-metadata-api-J1jMg`  \n")
    md.append(f"**Source:** `{BUNDLE_BASE}{{N}}.json` for `N ∈ [1, 35000]`  \n")
    md.append(f"**Scan duration:** {elapsed:.1f}s @ concurrency {CONCURRENCY}  \n")
    md.append(f"**Fetched:** {len(ids) - len(agg['failures'])} / {len(ids)} successful")
    if agg["failures"]:
        md.append(f", **{len(agg['failures'])} failures** (see §6).")
    else:
        md.append(", **0 failures**.")
    md.append("\n\n---\n\n## 0. TL;DR\n\n")

    flagged_axes = []
    for axis, expected in EXPECTED_VALUE_SETS.items():
        if expected is None:
            continue
        seen = set(agg["string_values"].get(axis, {}).keys())
        if seen and seen != expected:
            flagged_axes.append((axis, expected, seen))
    if flagged_axes:
        md.append(f"Bundle drifts from **{len(flagged_axes)}** repo-defined value set(s): "
                  + ", ".join(a[0] for a in flagged_axes) + ".\n\n")
    if agg["extra_traits"]:
        md.append(f"**{len(agg['extra_traits'])}** unrecognized trait keys found in bundle: "
                  + ", ".join(agg["extra_traits"]) + ".\n\n")
    if agg["missing_attrs_count"]:
        md.append(f"**{agg['missing_attrs_count']}** tokens missing one or more expected attribute keys.\n\n")
    if not flagged_axes and not agg["extra_traits"] and not agg["missing_attrs_count"]:
        md.append("Bundle aligns with all repo-defined expectations.\n\n")
    md.append("---\n\n## 1. Per-axis distinct values + counts\n\n")
    md.append("Sorted by frequency. ★ = present in bundle but NOT in repo's expected set; "
              "✗ = in repo's expected set but NOT in bundle.\n\n")

    for axis in EXPECTED_VALUE_SETS.keys():
        counts = agg["string_values"].get(axis)
        if not counts:
            md.append(f"### {axis}\n\n_(no data)_\n\n")
            continue
        expected = EXPECTED_VALUE_SETS[axis]
        seen = set(counts.keys())
        md.append(f"### {axis}\n\n")
        md.append(f"**Distinct values:** {len(counts)}  \n")
        md.append(f"**Total tokens:** {sum(counts.values())}\n\n")
        md.append("| Value | Count | % | Status |\n|---|---:|---:|---|\n")
        total = sum(counts.values())
        for v, c in counts.most_common():
            status = ""
            if expected is not None and v not in expected:
                status = "★ new"
            md.append(f"| `{v}` | {c} | {(100*c/total) if total else 0:.2f}% | {status} |\n")
        if expected is not None:
            for v in sorted(expected - seen):
                md.append(f"| `{v}` | 0 | 0.00% | ✗ in repo but not bundle |\n")
        md.append("\n")

    # Numeric ranges
    md.append("## 2. Numeric trait min/max\n\n")
    md.append("| Trait | Min | Max |\n|---|---:|---:|\n")
    for k in sorted(agg["numeric_minmax"]):
        lo, hi = agg["numeric_minmax"][k]
        md.append(f"| {k} | {lo} | {hi} |\n")
    md.append("\n")

    # Skill module ↔ corp
    md.append("## 3. Skill Module ↔ Corporation\n\n")
    md.append("| Corporation | Skill Modules | 1:1? |\n|---|---|---|\n")
    one_to_one = True
    for corp in sorted(agg["skill_module_by_corp"]):
        modules = agg["skill_module_by_corp"][corp]
        is_unique = len(modules) == 1
        if not is_unique:
            one_to_one = False
        cell = ", ".join(f"`{m}`×{c}" for m, c in modules.most_common())
        md.append(f"| `{corp}` | {cell} | {'✅' if is_unique else '❌'} |\n")
    md.append(f"\n**Verdict:** "
              f"{'✅ Skill Module is a deterministic function of Corporation across the full bundle.' if one_to_one else '❌ NOT 1:1 — investigate.'}\n\n")

    # Drift summary
    md.append("## 4. Drift summary (bundle vs. repo expectations)\n\n")
    if not flagged_axes:
        md.append("No drift detected on string-typed axes with repo-side expectations.\n\n")
    else:
        for axis, expected, seen in flagged_axes:
            new_in_bundle = seen - expected
            missing = expected - seen
            md.append(f"### {axis}\n\n")
            if new_in_bundle:
                md.append(f"- **{len(new_in_bundle)} new in bundle:** "
                          + ", ".join(f"`{v}`" for v in sorted(new_in_bundle)) + "\n")
            if missing:
                md.append(f"- **{len(missing)} in repo but not bundle:** "
                          + ", ".join(f"`{v}`" for v in sorted(missing)) + "\n")
            md.append("\n")

    if agg["extra_traits"]:
        md.append("## 5. Unrecognized trait keys\n\n")
        md.append("| Trait | Tokens |\n|---|---:|\n")
        for k, c in agg["extra_traits"].most_common():
            md.append(f"| `{k}` | {c} |\n")
        md.append("\n")

    if agg["failures"]:
        md.append(f"## 6. Fetch failures\n\nTotal: **{len(agg['failures'])}**. First 50:\n\n")
        md.append("| Token | Error |\n|---|---|\n")
        for tid, err in agg["failures"][:50]:
            md.append(f"| {tid} | {err} |\n")
        md.append("\n")

    md.append("## 7. Token attribute completeness\n\n"
              f"- Tokens missing expected keys: **{agg['missing_attrs_count']}**\n"
              f"- Min attributes per token: {min(agg['attrs_per_token']) if agg['attrs_per_token'] else 'n/a'}\n"
              f"- Max attributes per token: {max(agg['attrs_per_token']) if agg['attrs_per_token'] else 'n/a'}\n\n")

    md.append("---\n\n## 8. Output artifacts\n\n"
              "- `phase2-bundle-scan.md` — this report\n"
              "- `phase2-bundle-value-sets.json` — machine-readable, consumed by Phase 2.2 ingest\n\n"
              "## 9. Next step\n\n"
              "🛑 **HALT.** Do not proceed to migration or ingest until human reviews this "
              "report and `phase2-probe-results.md`.\n")

    out_md = REPO_ROOT / "phase2-bundle-scan.md"
    out_md.write_text("".join(md))
    _log(f"[scan] wrote {out_md}")

    return 0 if not agg["failures"] else 1


if __name__ == "__main__":
    sys.exit(main())
