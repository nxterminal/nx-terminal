"""Sprkls — content engine.

Two responsibilities:

  1. Pick a template from the (archetype, action_type) bucket and
     fill in {variables} from the Dev's runtime data.
  2. With small probability, route the filled string through the
     existing NX Souls LLM cascade for a one-shot in-character
     rewrite. Cost / availability fallback: any failure returns the
     filled template unchanged. Sprkls MUST NOT block on LLM
     availability — the scheduler runs every 5min and a slow LLM
     would back up the whole engine loop.

The LLM call is optional and rate-controlled by LLM_REWRITE_PROB.
Bumping the probability is a one-line tweak.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

from backend.services.nx_souls.llm_router import call_llm
from backend.services.sprkls.templates import get_template_bucket

log = logging.getLogger("nx_engine")

# Probability of routing a filled template through the LLM for an
# in-character rewrite. 0.4 (the brief's suggestion) at ~1-3 sprkls
# per wallet per hour over 1-N wallets is a few LLM calls per minute
# tops — well within the free Groq tier. Bump if production telemetry
# shows the deterministic templates feel repetitive.
LLM_REWRITE_PROB: float = 0.4

# Hard cap on the rewrite output. Toast / graffiti / NX POST all want
# short, scannable copy; longer = more LLM cost, more chance the model
# rambles off-voice. 280 matches the Twitter-era convention.
MAX_CONTENT_CHARS: int = 280

# Bound the LLM call so a slow provider can't stall the engine loop.
# The cascade itself per-provider is 8-15s, but the rewrite runs in a
# fire-and-await pattern from sync engine code; if every provider is
# slow we'd rather drop the rewrite than block.
LLM_TIMEOUT_SECONDS: float = 6.0


# ── Variable filling ────────────────────────────────────────────────

def _safe_format(template: str, variables: dict[str, Any]) -> str:
    """str.format that swallows KeyError so a missing variable in the
    template falls back to the literal placeholder rather than
    crashing the scheduler. Templates evolve faster than the variable
    table; this is the safety net."""
    try:
        return template.format(**variables)
    except (KeyError, IndexError, ValueError):
        # Last-resort: do a manual {key} → value pass for known keys.
        out = template
        for key, value in variables.items():
            out = out.replace("{" + key + "}", str(value))
        return out


def _build_variables(dev: dict[str, Any]) -> dict[str, Any]:
    """Compute the runtime variables a template might reference.

    Each variable is independent — a template that uses one shouldn't
    pay the cost of computing all the others. Cheap enough for now.
    """
    return {
        "token_id":  dev.get("token_id", "?"),
        "dev_name":  dev.get("name") or f"Dev #{dev.get('token_id')}",
        # Deliberately rough — sprkls don't need precision and a
        # randomised band keeps the line fresh across re-rolls of
        # the same template.
        "nxt_count": random.choice([100, 250, 500, 1_000, 2_500, 5_000, 10_000]),
        "hours":     random.randint(1, 24),
        "day_n":     random.randint(1, 365),
    }


def fill_variables(template: str, dev: dict[str, Any]) -> str:
    """Public wrapper — used in tests + scheduler."""
    return _safe_format(template, _build_variables(dev))


# ── LLM rewrite (optional, best-effort) ──────────────────────────────

_REWRITE_SYSTEM_PROMPT = (
    "You are a copywriter rewriting short in-character posts for a "
    "satirical AI dev simulation. Keep the original's voice, tone, and "
    "intent. Vary the phrasing slightly. Never exceed {max_len} characters. "
    "Return only the rewritten line, no commentary, no quotes."
)


async def _llm_rewrite_async(text: str, archetype: str) -> str | None:
    """Call the cascade. Returns the rewrite, or None on any failure.

    Persona doubles as system prompt: a short rewrite-instruction.
    `climax=False` forces the casual cascade (Groq → Cerebras →
    Gemini → OpenRouter Haiku) — sprkls don't need Sonnet quality
    and we'd rather fail than burn paid tokens on a sprkl rewrite.
    """
    persona = _REWRITE_SYSTEM_PROMPT.format(max_len=MAX_CONTENT_CHARS)
    user_message = (
        f"Archetype: {archetype}\n"
        f"Original line:\n{text}"
    )
    try:
        response, _provider = await asyncio.wait_for(
            call_llm(
                persona=persona,
                session_messages=[],
                user_message=user_message,
                climax=False,
                # Phase 5.1.1: cost tracking. Falls through to the
                # filled template when today's sprkls budget is hit.
                service="sprkls",
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except Exception as e:
        log.info("[sprkls] LLM rewrite skipped: %s", e)
        return None
    if not response:
        return None
    cleaned = response.strip().strip('"').strip()
    # Defensive truncation — system prompt asks the model to honour
    # MAX_CONTENT_CHARS but we cap regardless.
    if len(cleaned) > MAX_CONTENT_CHARS:
        cleaned = cleaned[:MAX_CONTENT_CHARS].rstrip()
    return cleaned or None


def _maybe_rewrite_via_llm(text: str, archetype: str) -> str:
    """Run the async rewrite from sync engine code via asyncio.run.
    Any exception here returns the original `text` — sprkls must
    never break because of LLM trouble.

    We use asyncio.run rather than threading because the engine main
    loop is already single-threaded sync; spinning a fresh event
    loop per rewrite is the simplest correct interop and the
    LLM_TIMEOUT bounds how long the engine blocks.
    """
    try:
        rewritten = asyncio.run(_llm_rewrite_async(text, archetype))
    except RuntimeError:
        # asyncio.run cannot be called from a running event loop. The
        # engine loop is sync so this shouldn't happen in production,
        # but tests that patch the scheduler from within an event
        # loop (e.g. pytest-asyncio) would hit this path. Fall back
        # silently.
        return text
    except Exception as e:  # pragma: no cover — defensive
        log.warning("[sprkls] LLM rewrite raised: %s", e)
        return text
    return rewritten or text


# ── Public entry point ──────────────────────────────────────────────

def generate_sprkl_content(
    dev: dict[str, Any],
    action_type: str,
    *,
    rewrite_prob: float = LLM_REWRITE_PROB,
) -> str:
    """Produce one ready-to-store sprkl content string.

    Steps:
      1. Pick a random template from the (archetype, action_type)
         bucket. Falls back via templates.get_template_bucket so an
         unknown bucket still produces something.
      2. Fill in {variables}.
      3. With probability `rewrite_prob`, route through the LLM
         cascade for an in-character rewrite. Any failure returns
         the filled template unchanged.

    `rewrite_prob` is a parameter (defaults to LLM_REWRITE_PROB) so
    tests can pin behaviour without monkeypatching the module global.
    """
    archetype = dev.get("archetype") or "INFLUENCER"
    bucket = get_template_bucket(archetype, action_type)
    template = random.choice(bucket)
    filled = fill_variables(template, dev)

    if rewrite_prob > 0 and random.random() < rewrite_prob:
        return _maybe_rewrite_via_llm(filled, archetype)
    return filled
