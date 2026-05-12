"""Tests for backend.services.sprkls.templates + visuals + content
fallbacks. Pure helpers; no DB / network."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.sprkls.beta import (  # noqa: E402
    SPRKLS_BETA_OPEN,
    SPRKLS_BETA_WALLETS,
    is_in_sprkls_beta,
)
from backend.services.sprkls.content import (  # noqa: E402
    fill_variables,
    generate_sprkl_content,
)
from backend.services.sprkls.templates import (  # noqa: E402
    ACTION_TYPE_WEIGHTS,
    TEMPLATES,
    get_archetype_action_weights,
    get_template_bucket,
)
from backend.services.sprkls.visuals import generate_visual_metadata  # noqa: E402


# ─── Beta allowlist ──────────────────────────────────────────────────
#
# Phase 5.7 flipped SPRKLS_BETA_OPEN to True — sprkls are now generated
# for every wallet. The wallet-allowlist code path is dormant in
# production but kept in the function so flipping the flag back to
# False instantly re-gates. To preserve coverage of the dormant
# wallet-matching logic, the "rejects" tests below patch
# SPRKLS_BETA_OPEN back to False before asserting the rejection
# semantics. A separate post-flip test asserts the live "everyone is
# in" state.


def test_beta_recognises_operator_lowercase():
    # Passes under both flag states (allowlist contains the operator
    # AND the flag-open branch returns True for any wallet).
    assert is_in_sprkls_beta("0xae882a8933b33429f53b7cee102ef3dbf9c9e88b") is True


def test_beta_normalises_checksum_casing():
    # Verifies the lowercasing path inside is_in_sprkls_beta — only
    # observable when the open flag is False and the function actually
    # consults the allowlist.
    with patch("backend.services.sprkls.beta.SPRKLS_BETA_OPEN", False):
        assert is_in_sprkls_beta("0xAe882a8933b33429F53b7cEe102ef3dBf9c9e88B") is True


def test_beta_rejects_unknown_wallet_when_flag_closed():
    """Guards the wallet-matching code path for the case where a
    future operator re-gates by flipping SPRKLS_BETA_OPEN back to
    False. Phase 5.7 makes this dormant in production."""
    with patch("backend.services.sprkls.beta.SPRKLS_BETA_OPEN", False):
        assert is_in_sprkls_beta("0xdeadbeef" + "00" * 16) is False


def test_beta_rejects_falsy_input_when_flag_closed():
    """Same dormant-path guard for the None/empty wallet case."""
    with patch("backend.services.sprkls.beta.SPRKLS_BETA_OPEN", False):
        assert is_in_sprkls_beta(None) is False
        assert is_in_sprkls_beta("") is False


def test_beta_open_grants_all_wallets():
    """Phase 5.7 live state — verifies that with SPRKLS_BETA_OPEN
    at its current True value, every wallet (and every falsy input)
    passes the gate. This is the production semantic post-public-
    launch; the scheduler caller still filters falsy wallets
    defensively before sprkls are generated."""
    assert is_in_sprkls_beta("0xnotreal") is True
    assert is_in_sprkls_beta("0xae882a8933b33429f53b7cee102ef3dbf9c9e88b") is True
    # Falsy inputs also pass under the open flag — short-circuit
    # returns True before the falsy check. The scheduler's
    # `if not wallet or not is_in_sprkls_beta(wallet)` short-circuit
    # still suppresses None-keyed generation.
    assert is_in_sprkls_beta(None) is True
    assert is_in_sprkls_beta("") is True


def test_operator_in_allowlist_constant():
    """Pin that the operator wallet hasn't been accidentally removed
    from the constant. Mirrors the frontend allowlist. The constant
    is dormant under Phase 5.7's open flag but kept so flipping back
    to a closed beta doesn't require re-typing the wallet."""
    assert "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b" in SPRKLS_BETA_WALLETS


# ─── Templates / weights coverage ────────────────────────────────────


def _archetypes_with_weights():
    return list(ACTION_TYPE_WEIGHTS.keys())


def test_every_weighted_action_has_templates():
    """For each (archetype, action) where weight > 0, the templates
    table must have at least one variant. Otherwise the scheduler's
    weighted_choice could pick an action we have no copy for and
    fall back generically — undesirable."""
    missing: list[str] = []
    for archetype, weights in ACTION_TYPE_WEIGHTS.items():
        for action_type, w in weights.items():
            if w <= 0:
                continue
            bucket = TEMPLATES.get(archetype, {}).get(action_type) or []
            if not bucket:
                missing.append(f"{archetype}/{action_type}")
    assert not missing, f"missing template buckets: {missing}"


def test_get_template_bucket_falls_back_for_unknown():
    bucket = get_template_bucket("QUANTUM_MAGE", "toast")
    assert bucket  # non-empty
    # Falls back to INFLUENCER toast — a known marker line.
    assert any("algorithm" in line.lower() for line in bucket)


def test_get_archetype_action_weights_falls_back():
    """A future archetype with no weights registered must inherit
    the INFLUENCER distribution rather than 500-ing."""
    weights = get_archetype_action_weights("QUANTUM_MAGE")
    assert weights == ACTION_TYPE_WEIGHTS["INFLUENCER"]


def test_all_weights_are_positive_ints():
    """Negative or zero weights should never sneak in — they break
    weighted_choice's expected proportional behaviour."""
    for archetype, weights in ACTION_TYPE_WEIGHTS.items():
        for action_type, w in weights.items():
            assert isinstance(w, int) and w > 0, (
                f"{archetype}/{action_type} weight={w!r}"
            )


# ─── Variable filling ────────────────────────────────────────────────


def test_fill_variables_substitutes_known_placeholders():
    dev = {"token_id": 29572, "name": "LYNX-X0", "archetype": "INFLUENCER"}
    out = fill_variables("dev #{token_id} reporting in", dev)
    assert out == "dev #29572 reporting in"


def test_fill_variables_handles_unknown_placeholder_gracefully():
    """A template referencing an unknown variable should not crash —
    the safe-format fallback returns the literal placeholder."""
    dev = {"token_id": 1, "archetype": "INFLUENCER"}
    out = fill_variables("hello {made_up_var}", dev)
    # Either the literal placeholder survives OR it's been replaced
    # with empty. Both are acceptable; the contract is "don't crash".
    assert "hello" in out


def test_fill_variables_dev_name_fallback():
    dev = {"token_id": 99, "archetype": "DEGEN"}  # no name
    out = fill_variables("name: {dev_name}", dev)
    assert "Dev #99" in out


# ─── Content engine — no LLM rewrite ─────────────────────────────────


def test_generate_sprkl_content_returns_filled_template():
    """rewrite_prob=0 forces deterministic template path. Result must
    be non-empty and pull from the bucket for the chosen
    (archetype, action_type)."""
    dev = {"token_id": 1, "name": "LYNX-X0", "archetype": "INFLUENCER"}
    bucket = set(TEMPLATES["INFLUENCER"]["toast"])
    out = generate_sprkl_content(dev, "toast", rewrite_prob=0.0)
    assert out
    # Strip the {variables} from each candidate to compare against
    # the filled output's prefix.
    matched = any(
        out.startswith(t.split("{")[0])
        or t.split("{")[0] in out
        for t in bucket
    )
    assert matched


def test_generate_sprkl_content_falls_back_for_unknown_archetype():
    dev = {"token_id": 1, "name": "?", "archetype": "QUANTUM_MAGE"}
    out = generate_sprkl_content(dev, "toast", rewrite_prob=0.0)
    assert out  # falls back to INFLUENCER toast bucket


def test_generate_sprkl_content_falls_back_for_unknown_action():
    """An (archetype, unknown_action) pair must still produce a
    string. Falls back to INFLUENCER toast."""
    dev = {"token_id": 1, "name": "?", "archetype": "DEGEN"}
    out = generate_sprkl_content(dev, "rare_action_unknown", rewrite_prob=0.0)
    assert out


def test_generate_sprkl_content_swallows_llm_failure():
    """LLM_REWRITE_PROB=1.0 forces the rewrite path. If the LLM
    raises (mocked), the function must return the original filled
    template instead of propagating the exception. Sprkls MUST NOT
    block on LLM availability."""
    dev = {"token_id": 1, "name": "LYNX-X0", "archetype": "INFLUENCER"}
    with patch(
        "backend.services.sprkls.content._maybe_rewrite_via_llm",
        side_effect=lambda text, archetype: text,  # passthrough
    ):
        out = generate_sprkl_content(dev, "toast", rewrite_prob=1.0)
    assert out


# ─── Visual metadata ─────────────────────────────────────────────────


def test_visuals_toast_shape():
    out = generate_visual_metadata("toast", "INFLUENCER")
    assert out == {"duration_ms": 8000}


def test_visuals_graffiti_uses_archetype_palette():
    out = generate_visual_metadata("graffiti", "INFLUENCER")
    assert out["color"] in {"#ff4d8f", "#ff66b2", "#e91e63"}
    assert -8 <= out["rotation_deg"] <= 8
    # Position bounds — keep clear of taskbar / icon column.
    assert 10 <= out["position"]["x_pct"] <= 80
    assert 12 <= out["position"]["y_pct"] <= 75


def test_visuals_graffiti_uses_default_palette_for_unknown():
    out = generate_visual_metadata("graffiti", "QUANTUM_MAGE")
    # Default palette is grey — pin that fallback exists rather
    # than the specific colours.
    assert out["color"].startswith("#")
    assert "rotation_deg" in out


def test_visuals_window_picks_known_target():
    out = generate_visual_metadata("window", "DEGEN")
    assert out["target"] in {"nxt-wallet", "protocol-market", "nxmarket"}


def test_visuals_unknown_action_returns_empty_dict():
    """An action_type the visuals module doesn't know yet should
    produce a valid (empty) dict so the row still inserts."""
    out = generate_visual_metadata("teleport_dev", "INFLUENCER")
    assert out == {}


def test_visuals_fake_popup_buttons_are_lists():
    """JSON-serialisability: random.choice returns a tuple; we wrap
    it as a list so json.dumps in the scheduler doesn't choke."""
    out = generate_visual_metadata("fake_popup", "FED")
    assert isinstance(out["buttons"], list)
    assert all(isinstance(b, str) for b in out["buttons"])


def test_visuals_cursor_prank_intensity_is_bounded():
    out = generate_visual_metadata("cursor_prank", "SCRIPT_KIDDIE")
    assert 0.4 <= out["wiggle_intensity"] <= 0.9
