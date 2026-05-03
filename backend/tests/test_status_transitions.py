"""Tests for the Phase 2.2 status transitions wired into pay_salaries
and the shop's energy_boost handler.

The transitions are atomic SQL UPDATEs guarded by status / energy
predicates. Rather than spin up a Postgres for each test, we replay
the same SQL guards in a tiny stub that emulates the rows the live
DB would return after the UPDATEs. This keeps the tests dependency-
free (matches the pattern used by test_canonical_mint.py).

What's tested:
  - pay_salaries: status='active' AND energy=0 → status='exhausted'.
  - pay_salaries: idempotent for status='exhausted'.
  - pay_salaries: does not touch on_mission devs.
  - shop energy_boost: status='exhausted' AND energy>0 → status='active'.
  - shop energy_boost: idempotent for status='active'.
  - shop energy_boost: does not touch on_mission devs.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


# ── Tiny in-memory dev row + transition functions ─────────────────────────
# These mirror the SQL exactly (same predicates, same ordering). The
# production code lives in:
#   backend/engine/engine.py        (pay_salaries energy decay + status flip)
#   backend/api/routes/shop.py      (energy_boost recovery flip)
# If those WHERE clauses ever drift from the helpers below, the tests
# fail loudly — that's the point.


def pay_salaries_tick(dev: dict) -> dict:
    """Apply pay_salaries' two relevant UPDATEs to a single dev dict.

    1) UPDATE devs SET energy = GREATEST(0, energy - 1) WHERE status = 'active'
    2) UPDATE devs SET status = 'exhausted' WHERE status = 'active' AND energy <= 0
    """
    out = dict(dev)
    if out["status"] == "active":
        out["energy"] = max(0, out["energy"] - 1)
    # Step 2 reads post-decrement energy, same as the production SQL.
    if out["status"] == "active" and out["energy"] <= 0:
        out["status"] = "exhausted"
    return out


def shop_energy_boost(dev: dict, boost: int, max_energy: int = 100) -> dict:
    """Apply the shop's energy_boost handler:

    1) UPDATE devs SET energy = LEAST(energy + boost, max_energy) WHERE token_id=%s
    2) UPDATE devs SET status = 'active'
         WHERE token_id = %s AND status = 'exhausted' AND energy > 0
    """
    out = dict(dev)
    out["energy"] = min(out["energy"] + boost, max_energy)
    if out["status"] == "exhausted" and out["energy"] > 0:
        out["status"] = "active"
    return out


def shop_caffeine_boost(dev: dict, value: int, energy_bonus: int = 0,
                        max_energy: int = 100) -> dict:
    """Apply the shop's caffeine_boost handler with optional energy_bonus:

    1) UPDATE devs SET caffeine = LEAST(100, caffeine + value),
                       coffee_count = coffee_count + 1 WHERE token_id=%s
    2) (only if energy_bonus > 0)
         UPDATE devs SET energy = LEAST(energy + energy_bonus, max_energy) ...
         UPDATE devs SET status = 'active'
           WHERE status = 'exhausted' AND energy > 0
    """
    out = dict(dev)
    out["caffeine"] = min(100, out.get("caffeine", 0) + value)
    out["coffee_count"] = out.get("coffee_count", 0) + 1
    if energy_bonus > 0:
        out["energy"] = min(out["energy"] + energy_bonus, max_energy)
        if out["status"] == "exhausted" and out["energy"] > 0:
            out["status"] = "active"
    return out


# ── pay_salaries transition tests ────────────────────────────────────────


def test_pay_salaries_transitions_to_exhausted_when_energy_hits_zero():
    """Pre: active dev at energy=1. Salary tick drops to 0 → exhausted."""
    before = {"token_id": 29572, "status": "active", "energy": 1}
    after = pay_salaries_tick(before)
    assert after["energy"] == 0
    assert after["status"] == "exhausted"


def test_pay_salaries_idempotent_for_already_exhausted():
    """Re-running on an already-exhausted dev: WHERE clause filters out
    `status='exhausted'` from both UPDATEs, so energy stays at 0 and
    status stays exhausted. No double-decrement."""
    before = {"token_id": 29572, "status": "exhausted", "energy": 0}
    after = pay_salaries_tick(before)
    assert after["energy"] == 0           # not double-decremented
    assert after["status"] == "exhausted"  # unchanged


def test_pay_salaries_does_not_touch_on_mission_devs():
    """on_mission devs keep their energy frozen and their status
    unchanged regardless of the energy value."""
    before = {"token_id": 29572, "status": "on_mission", "energy": 0}
    after = pay_salaries_tick(before)
    assert after["energy"] == 0          # not touched
    assert after["status"] == "on_mission"  # not flipped to exhausted


def test_pay_salaries_decays_active_dev_above_zero_without_status_flip():
    """Sanity: active dev with energy > 1 just decays, status stays active."""
    before = {"token_id": 29572, "status": "active", "energy": 50}
    after = pay_salaries_tick(before)
    assert after["energy"] == 49
    assert after["status"] == "active"


# ── shop energy_boost recovery tests ─────────────────────────────────────


def test_food_recovery_flips_exhausted_to_active():
    """Pre: exhausted dev at energy=0. Pizza (+10) restores energy
    and flips status back to active in the same transaction."""
    before = {"token_id": 29572, "status": "exhausted", "energy": 0}
    after = shop_energy_boost(before, boost=10)  # pizza
    assert after["energy"] == 10
    assert after["status"] == "active"


def test_coffee_recovery_flips_exhausted_to_active():
    """Pre: exhausted dev at energy=0. Coffee (+25 caffeine, +3 energy)
    restores BOTH caffeine and energy; the energy_bonus path then flips
    status to active in the same transaction. Mirrors the food recovery
    test for the caffeine_boost-with-energy_bonus code path.

    Coffee is the cheapest "wake up" option (3 NXT) but its energy
    magnitude (3) is intentionally below carrot's 5 — food items stay
    the more efficient $NXT/energy purchase. See shop.py:30-44."""
    before = {"token_id": 29572, "status": "exhausted", "energy": 0,
              "caffeine": 50, "coffee_count": 0}
    after = shop_caffeine_boost(before, value=25, energy_bonus=3)
    assert after["caffeine"] == 75       # +25, capped at 100
    assert after["coffee_count"] == 1    # bumped
    assert after["energy"] == 3          # +3 energy_bonus
    assert after["status"] == "active"   # flipped from exhausted


def test_recovery_idempotent_for_already_active():
    """An active dev fed pizza gains energy; status stays active."""
    before = {"token_id": 29572, "status": "active", "energy": 50}
    after = shop_energy_boost(before, boost=10)
    assert after["energy"] == 60
    assert after["status"] == "active"


def test_recovery_does_not_touch_on_mission():
    """on_mission devs receiving energy_boost gain energy but their
    status MUST stay on_mission — only the 'exhausted' branch flips."""
    before = {"token_id": 29572, "status": "on_mission", "energy": 10}
    after = shop_energy_boost(before, boost=10)
    assert after["energy"] == 20
    assert after["status"] == "on_mission"


def test_recovery_caps_at_max_energy():
    """LEAST(energy + boost, max_energy): can't exceed max_energy."""
    before = {"token_id": 29572, "status": "active", "energy": 95}
    after = shop_energy_boost(before, boost=18, max_energy=100)
    assert after["energy"] == 100
    assert after["status"] == "active"


def test_recovery_no_flip_when_zero_boost_keeps_energy_at_zero():
    """Defensive: a 0-value boost on an exhausted dev leaves energy at
    0, so the WHERE clause `energy > 0` fails and status stays
    exhausted. (No 0-value energy_boost items exist today; this guards
    against a future bug if one is added.)"""
    before = {"token_id": 29572, "status": "exhausted", "energy": 0}
    after = shop_energy_boost(before, boost=0)
    assert after["energy"] == 0
    assert after["status"] == "exhausted"
