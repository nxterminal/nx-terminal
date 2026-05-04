"""NX Souls — LLM cascade router.

Tries free / cheap providers first, falls back to paid Anthropic via
OpenRouter. Each provider speaks an OpenAI-compatible Chat Completions
JSON shape (so we use one HTTP client and one parser).

Provider order:
  1. Groq         — fastest, free 30 req/min. Llama 3.3 70B versatile.
  2. Cerebras     — second fastest, free ~10k req/day. Llama 3.3 70B.
  3. Gemini       — third fallback, free 60 req/min. (OpenAI-compat endpoint.)
  4. OpenRouter   — paid last resort. Claude Haiku by default,
                    Claude Sonnet for "climax" turns.

Climax detection (deeper / longer / philosophical messages) skips the
free cascade and routes straight to OpenRouter Sonnet so the high-stakes
moments don't ride a 7B fallback.

Failure model:
  - Per-provider RateLimited / Timeout / NetworkError → log, try next.
  - All providers exhausted → raise NXSoulsAllProvidersFailed.
  - Missing API key → provider skipped at startup (logged once).

This module deliberately holds NO state about the Dev that's chatting —
the persona prompt is passed in. The persona generator owns Dev state.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Iterable

import httpx

from backend.services.nx_souls.exceptions import (
    NXSoulsAllProvidersFailed,
    NXSoulsProviderUnavailable,
)

log = logging.getLogger("nx_api")


# ─── Provider configuration ───────────────────────────────────────────────

@dataclass(frozen=True)
class ProviderSpec:
    """Static config for one provider in the cascade.

    `auth_header_name` is "Authorization" for every current provider, but
    keeping it explicit means a future provider with a quirky scheme
    (e.g. `x-api-key` on Anthropic native) plugs in trivially.
    """
    name: str
    base_url: str
    model: str
    api_key_env: str
    timeout_seconds: float
    auth_header_name: str = "Authorization"
    auth_header_prefix: str = "Bearer "
    extra_headers: dict[str, str] | None = None


# Order in this list defines the cascade order.
# Models pinned to their public free-tier names as of the Phase A brief.
GROQ = ProviderSpec(
    name="groq",
    base_url="https://api.groq.com/openai/v1/chat/completions",
    model="llama-3.3-70b-versatile",
    api_key_env="GROQ_API_KEY",
    timeout_seconds=8.0,
)
CEREBRAS = ProviderSpec(
    name="cerebras",
    base_url="https://api.cerebras.ai/v1/chat/completions",
    model="llama-3.3-70b",
    api_key_env="CEREBRAS_API_KEY",
    timeout_seconds=8.0,
)
GEMINI = ProviderSpec(
    name="gemini",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model="gemini-2.0-flash-exp",
    api_key_env="GEMINI_API_KEY",
    timeout_seconds=12.0,
)
OPENROUTER_HAIKU = ProviderSpec(
    name="openrouter-haiku",
    base_url="https://openrouter.ai/api/v1/chat/completions",
    model="anthropic/claude-haiku-4.5",
    api_key_env="OPENROUTER_API_KEY",
    timeout_seconds=15.0,
    extra_headers={
        "HTTP-Referer": "https://nxterminal.xyz",
        "X-Title": "NX Terminal",
    },
)
OPENROUTER_SONNET = ProviderSpec(
    name="openrouter-sonnet",
    base_url="https://openrouter.ai/api/v1/chat/completions",
    model="anthropic/claude-sonnet-4.6",
    api_key_env="OPENROUTER_API_KEY",
    timeout_seconds=15.0,
    extra_headers={
        "HTTP-Referer": "https://nxterminal.xyz",
        "X-Title": "NX Terminal",
    },
)

STANDARD_CASCADE: tuple[ProviderSpec, ...] = (
    GROQ, CEREBRAS, GEMINI, OPENROUTER_HAIKU,
)
CLIMAX_CASCADE: tuple[ProviderSpec, ...] = (
    OPENROUTER_SONNET, OPENROUTER_HAIKU,
)


# ─── Token budgets (anti-essay defence-in-depth) ──────────────────────────
#
# Phase 2a's prompt-level length discipline gets the model to deflect
# essay requests verbally, but a casual-sized budget at the API layer
# is the second wall: even when the deflection is honoured the model
# can't accidentally over-comply by emitting 300+ words of "casual"
# explanation. Phase 2b fix.
#
#   climax=False (default chat)  → MAX_TOKENS_CASUAL  (anti-essay budget)
#   climax=True  (philosophical) → MAX_TOKENS_CLIMAX  (room for genuine
#                                                     thoughtfulness)
#
# 200 tokens covers ~150 English words / 3-5 normal-length sentences,
# which is the upper end of what `LENGTH DISCIPLINE` calls "casual".
# 600 keeps the previous ceiling for deep / long replies.
MAX_TOKENS_CASUAL = 200
MAX_TOKENS_CLIMAX = 600


# ─── Climax detection ─────────────────────────────────────────────────────

# Words/phrases that flag a "deep" turn worth burning a Sonnet call on.
_CLIMAX_TERMS: frozenset[str] = frozenset({
    "soul", "exist", "real", "alive", "purpose", "die", "death", "remember",
    "consciousness", "ai", "simulation", "creator", "god", "afterlife",
    "meaning", "what are you", "are you real",
})


def is_climax_turn(user_message: str, session_message_count: int = 0) -> bool:
    """Decide whether to route this turn to the high-quality (paid) model.

    A turn is a "climax" if any of these are true:
      - message length > 200 chars (the user is being thoughtful)
      - contains '?' or '??'      (a question is being asked)
      - contains a philosophical marker word
      - we're 5+ messages deep    (the conversation has stakes)
    """
    if not user_message:
        return False
    msg = user_message.strip()
    if len(msg) > 200:
        return True
    if "?" in msg:
        return True
    if session_message_count >= 5:
        return True
    lowered = msg.lower()
    return any(term in lowered for term in _CLIMAX_TERMS)


# ─── Provider availability ────────────────────────────────────────────────

# Cached provider→bool result of the env-var check, populated lazily on
# first call. Avoids a getenv on every request and keeps the startup
# message ("provider X disabled") to one line per provider per process.
_availability_cache: dict[str, bool] = {}


def _is_available(provider: ProviderSpec) -> bool:
    cached = _availability_cache.get(provider.name)
    if cached is not None:
        return cached
    has_key = bool(os.environ.get(provider.api_key_env))
    _availability_cache[provider.name] = has_key
    if not has_key:
        log.warning(
            f"NX Souls router: {provider.name} disabled "
            f"(missing {provider.api_key_env})"
        )
    return has_key


def reset_availability_cache() -> None:
    """Test hook — re-read env vars on next call."""
    _availability_cache.clear()


def log_router_status() -> None:
    """One-shot startup summary. Safe to call from main.lifespan."""
    parts = []
    for p in (GROQ, CEREBRAS, GEMINI, OPENROUTER_HAIKU):
        parts.append(f"{p.name}={'ok' if _is_available(p) else 'disabled'}")
    log.info("NX Souls router initialized: " + ", ".join(parts))


# ─── Single provider call ─────────────────────────────────────────────────

class _RetryableProviderError(Exception):
    """Internal — raised when a provider call fails in a way the cascade
    should swallow and try the next provider for. Never escapes this
    module; the cascade converts it into NXSoulsAllProvidersFailed if
    every provider raises it.
    """


async def _call_provider(
    client: httpx.AsyncClient,
    provider: ProviderSpec,
    messages: list[dict[str, str]],
    *,
    max_tokens: int,
    temperature: float = 0.85,
) -> str:
    """Make one Chat-Completions call. Returns assistant text.

    `max_tokens` is required (no default) so the budget is always an
    explicit decision at the call site — the climax-vs-casual choice
    is made in `call_llm` and threaded through here. Removing the
    default catches any future caller that forgets to pass it.

    Raises `_RetryableProviderError` for any failure the cascade should
    treat as "try the next provider" — that includes 429 rate limits,
    5xx, timeouts, network errors, malformed responses, and 401/403
    (treat auth failures as "skip this provider for now"; the operator
    will see them in logs).
    """
    api_key = os.environ.get(provider.api_key_env)
    if not api_key:
        # Defensive — _is_available should have filtered this out already.
        raise NXSoulsProviderUnavailable(provider.name)

    headers = {
        provider.auth_header_name: f"{provider.auth_header_prefix}{api_key}",
        "Content-Type": "application/json",
    }
    if provider.extra_headers:
        headers.update(provider.extra_headers)

    payload: dict[str, Any] = {
        "model": provider.model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    try:
        resp = await client.post(
            provider.base_url,
            headers=headers,
            json=payload,
            timeout=provider.timeout_seconds,
        )
    except (httpx.TimeoutException, httpx.NetworkError, httpx.ProtocolError) as e:
        log.warning(f"NX Souls router: {provider.name} network/timeout: {e}")
        raise _RetryableProviderError(str(e))

    if resp.status_code == 429:
        log.info(f"NX Souls router: {provider.name} rate-limited (429)")
        raise _RetryableProviderError("rate_limited")
    if resp.status_code in (401, 403):
        log.warning(
            f"NX Souls router: {provider.name} auth error "
            f"({resp.status_code}) — check API key"
        )
        raise _RetryableProviderError(f"auth_{resp.status_code}")
    if resp.status_code >= 500:
        log.warning(f"NX Souls router: {provider.name} server error ({resp.status_code})")
        raise _RetryableProviderError(f"server_{resp.status_code}")
    if resp.status_code >= 400:
        log.warning(
            f"NX Souls router: {provider.name} client error "
            f"({resp.status_code}): {resp.text[:200]}"
        )
        raise _RetryableProviderError(f"client_{resp.status_code}")

    try:
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError, TypeError) as e:
        log.warning(f"NX Souls router: {provider.name} malformed response: {e}")
        raise _RetryableProviderError(f"malformed: {e}")

    if not text or not text.strip():
        # Empty completion — treat as a soft failure so the next provider
        # gets a chance instead of returning a blank reply to the user.
        raise _RetryableProviderError("empty_response")

    return text.strip()


# ─── Cascade ──────────────────────────────────────────────────────────────

def _build_messages(
    persona: str,
    session_messages: Iterable[dict[str, str]],
    user_message: str,
) -> list[dict[str, str]]:
    """Compose the OpenAI-style messages list. Persona becomes the
    `system` message; session history (already filtered to role+content
    by the caller) lands between system and the new user turn.
    """
    out: list[dict[str, str]] = [{"role": "system", "content": persona}]
    for m in session_messages:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content:
            out.append({"role": role, "content": content})
    out.append({"role": "user", "content": user_message})
    return out


async def call_llm(
    persona: str,
    session_messages: Iterable[dict[str, str]],
    user_message: str,
    *,
    climax: bool | None = None,
) -> tuple[str, str]:
    """Run the cascade. Returns (assistant_text, provider_name_used).

    Raises NXSoulsAllProvidersFailed when no provider succeeds.

    `climax` overrides automatic detection. Pass None (default) to use
    `is_climax_turn(user_message, len(session_messages))`.
    """
    session_list = list(session_messages)
    if climax is None:
        climax = is_climax_turn(user_message, len(session_list))
    cascade = CLIMAX_CASCADE if climax else STANDARD_CASCADE
    # Token budget mirrors the cascade choice. Casual turns get the
    # anti-essay ceiling (200) so a Dev that already deflected at the
    # prompt layer can't quietly over-comply with 300+ word output;
    # climax turns get headroom (600) for genuine thoughtfulness.
    max_tokens = MAX_TOKENS_CLIMAX if climax else MAX_TOKENS_CASUAL

    available = [p for p in cascade if _is_available(p)]
    if not available:
        log.error("NX Souls router: no providers available — cannot call LLM")
        raise NXSoulsAllProvidersFailed("no_providers_configured")

    messages = _build_messages(persona, session_list, user_message)

    async with httpx.AsyncClient() as client:
        for provider in available:
            try:
                text = await _call_provider(
                    client, provider, messages, max_tokens=max_tokens
                )
            except _RetryableProviderError:
                continue
            except NXSoulsProviderUnavailable:
                continue
            return text, provider.name

    raise NXSoulsAllProvidersFailed("all_providers_exhausted")
