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
from backend.services import llm_cost

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

# Phase 5.4 — chat↔post context bridge marker.
#
# When the chat endpoint resolves a `referenced_post_id` to actual post
# content, that content is injected as a synthetic prior `assistant`
# turn so the Dev "remembers" writing it. The marker prefix on the
# in-memory message lets us:
#   1. Detect the synthetic turn in a follow-up call's session_messages
#      and skip re-injecting (no-stacking).
#   2. Filter the synthetic turn from is_climax_turn's depth count, so
#      a single "re: <post>" injection can't tip a casual chat onto the
#      paid Sonnet path.
# The marker is stripped from outgoing assistant content right before
# the HTTP call to providers — providers only ever see the raw post
# text, never the marker. See `_strip_post_ref_markers`.
POST_REF_MARKER: str = "<MARKER:POST_REF>"

# Cap injected post content. Posts are usually <280 chars; this
# defends against a future schema migration that lengthens them.
MAX_POST_REF_CHARS: int = 500

# Words/phrases that flag a "deep" turn worth burning a Sonnet call on.
_CLIMAX_TERMS: frozenset[str] = frozenset({
    "soul", "exist", "real", "alive", "purpose", "die", "death", "remember",
    "consciousness", "ai", "simulation", "creator", "god", "afterlife",
    "meaning", "what are you", "are you real",
})


def is_climax_turn(user_message: str, session_messages=0) -> bool:
    """Decide whether to route this turn to the high-quality (paid) model.

    A turn is a "climax" if any of these are true:
      - message length > 200 chars (the user is being thoughtful)
      - contains '?' or '??'      (a question is being asked)
      - contains a philosophical marker word
      - we're 5+ messages deep    (the conversation has stakes)

    `session_messages` accepts either an int (legacy callers — counts
    are taken at face value) or an iterable of message dicts (Phase 5.4
    callers — synthetic post-reference turns are filtered out before
    counting so a `re: "<post>"` injection doesn't push borderline
    casual exchanges onto the paid Sonnet path).
    """
    if not user_message:
        return False
    msg = user_message.strip()
    if len(msg) > 200:
        return True
    if "?" in msg:
        return True
    # Depth check — filter synthetic post-reference turns when the
    # caller hands us the message list. They're plumbing, not real
    # conversation, and shouldn't tip the climax threshold.
    if isinstance(session_messages, int):
        depth = session_messages
    else:
        depth = sum(
            1
            for m in session_messages
            if not str(m.get("content", "")).startswith(POST_REF_MARKER)
        )
    if depth >= 5:
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
) -> tuple[str, int, int]:
    """Make one Chat-Completions call. Returns
    (assistant_text, input_tokens, output_tokens).

    Token counts come from the OpenAI-compat `usage` block; if
    a provider omits the field (some pre-release endpoints do)
    we return zeros and the cost tracker books $0 for that call.
    Better than refusing to record at all — call_count + zero
    cost is still observability.

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

    # Extract token counts from the OpenAI-compat `usage` block. All
    # current cascade providers populate it; defensive .get/0 keeps
    # us robust against a future provider that omits the field.
    usage = data.get("usage") or {}
    try:
        input_tokens = int(usage.get("prompt_tokens") or 0)
        output_tokens = int(usage.get("completion_tokens") or 0)
    except (TypeError, ValueError):
        input_tokens = 0
        output_tokens = 0

    return text.strip(), input_tokens, output_tokens


# ─── Cascade ──────────────────────────────────────────────────────────────

def _build_messages(
    persona: str,
    session_messages: Iterable[dict[str, str]],
    user_message: str,
    referenced_post_content: str | None = None,
) -> list[dict[str, str]]:
    """Compose the OpenAI-style messages list. Persona becomes the
    `system` message; session history (already filtered to role+content
    by the caller) lands between system and the new user turn.

    Phase 5.4: if `referenced_post_content` is provided, insert a
    synthetic prior `assistant` turn carrying the post text just before
    the user's new turn. The marker prefix (`POST_REF_MARKER`) makes
    the synthetic origin detectable in follow-up calls; it is stripped
    right before the HTTP send via `_strip_post_ref_markers`. Caller
    is responsible for the no-stacking check (in `call_llm`) and the
    char cap.
    """
    out: list[dict[str, str]] = [{"role": "system", "content": persona}]
    for m in session_messages:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content:
            out.append({"role": role, "content": content})
    if referenced_post_content:
        out.append({
            "role": "assistant",
            "content": POST_REF_MARKER + referenced_post_content,
        })
    out.append({"role": "user", "content": user_message})
    return out


def _strip_post_ref_markers(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Pre-send pass: walk the messages list, strip the POST_REF_MARKER
    prefix from any assistant content. Providers only see the raw post
    text. We return a NEW list (don't mutate caller's data) so the same
    list can be reused across the cascade with the marker still in
    place for inspection / retries."""
    out: list[dict[str, str]] = []
    for m in messages:
        content = m.get("content", "")
        if (
            m.get("role") == "assistant"
            and isinstance(content, str)
            and content.startswith(POST_REF_MARKER)
        ):
            stripped = content[len(POST_REF_MARKER):]
            out.append({**m, "content": stripped})
        else:
            out.append(m)
    return out


def _session_already_has_post_ref(session_messages: Iterable[dict[str, str]]) -> bool:
    """No-stacking guard. If a previous call in the same session already
    injected a synthetic post-ref turn, the frontend is expected to be
    carrying it forward in `session_messages`; injecting another one
    would double-quote and waste tokens. Detect by marker prefix."""
    for m in session_messages:
        content = m.get("content")
        if isinstance(content, str) and content.startswith(POST_REF_MARKER):
            return True
    return False


async def call_llm(
    persona: str,
    session_messages: Iterable[dict[str, str]],
    user_message: str,
    *,
    climax: bool | None = None,
    service: str | None = None,
    referenced_post_content: str | None = None,
) -> tuple[str, str]:
    """Run the cascade. Returns (assistant_text, provider_name_used).

    Raises NXSoulsAllProvidersFailed when no provider succeeds, OR
    `NXSoulsAllProvidersFailed("daily_limit_exceeded")` when the
    cost-tracker reports `service` has spent past its daily ceiling.
    The exception lets the existing per-caller fallback paths
    (template content / "I'm tired" replies) handle the outage in
    their natural way; we don't need a separate signal channel.

    `climax` overrides automatic detection. Pass None (default) to
    use `is_climax_turn(user_message, len(session_messages))`.

    `service` is the cost-tracking key — one of "sprkls",
    "posts_feed", "nx_souls". When unset (None), cost tracking is
    skipped entirely. This keeps the existing test harness (which
    calls call_llm without a service kwarg) working without
    changes, and lets new callers opt in by passing the kwarg.
    """
    # Phase 5.1.1 pre-call cost gate. is_under_daily_limit_safe
    # opens its own short-lived conn + swallows every exception, so
    # a cost-tracker outage degrades to "always allow" rather than
    # blocking LLM calls. That's the right failure mode — Anthropic's
    # console hard cap is the absolute backstop.
    if service is not None and not llm_cost.is_under_daily_limit_safe(service):
        log.warning(
            "NX Souls router: %s daily LLM cost limit exceeded — "
            "falling through to template", service,
        )
        raise NXSoulsAllProvidersFailed("daily_limit_exceeded")

    session_list = list(session_messages)
    # Phase 5.4 — pass the message LIST (not just count) so
    # is_climax_turn can filter synthetic post-ref turns from the
    # depth check. A bare "re: <post>" exchange shouldn't tip a
    # casual chat onto Sonnet just because its session_messages now
    # carries the synthetic injection from the previous turn.
    if climax is None:
        climax = is_climax_turn(user_message, session_list)
    cascade = CLIMAX_CASCADE if climax else STANDARD_CASCADE

    # Phase 5.4 — no-stacking guard. If the session already carries a
    # synthetic post-ref (from a prior call in the same chat), drop the
    # newly-passed referenced_post_content. The injection only happens
    # ONCE per chat opened; afterwards session_messages keeps it alive.
    if referenced_post_content and _session_already_has_post_ref(session_list):
        log.info(
            "NX Souls router: post-ref already in session, skipping re-inject"
        )
        referenced_post_content = None
    # Defensive char cap. The route layer caps too, but enforcing here
    # protects any future caller (CLI, replay tool) that bypasses the
    # route validation.
    if referenced_post_content and len(referenced_post_content) > MAX_POST_REF_CHARS:
        referenced_post_content = referenced_post_content[:MAX_POST_REF_CHARS]
    # Token budget mirrors the cascade choice. Casual turns get the
    # anti-essay ceiling (200) so a Dev that already deflected at the
    # prompt layer can't quietly over-comply with 300+ word output;
    # climax turns get headroom (600) for genuine thoughtfulness.
    max_tokens = MAX_TOKENS_CLIMAX if climax else MAX_TOKENS_CASUAL

    available = [p for p in cascade if _is_available(p)]
    if not available:
        log.error("NX Souls router: no providers available — cannot call LLM")
        raise NXSoulsAllProvidersFailed("no_providers_configured")

    messages = _build_messages(
        persona, session_list, user_message,
        referenced_post_content=referenced_post_content,
    )
    # Strip the marker right before the HTTP send. Providers see only
    # the raw post text in the synthetic assistant turn — never the
    # internal plumbing prefix. The unstripped `messages` list above
    # stays intact in case a future iteration of the cascade wants to
    # inspect / re-evaluate it.
    outgoing = _strip_post_ref_markers(messages)

    async with httpx.AsyncClient() as client:
        for provider in available:
            try:
                text, input_tokens, output_tokens = await _call_provider(
                    client, provider, outgoing, max_tokens=max_tokens
                )
            except _RetryableProviderError:
                continue
            except NXSoulsProviderUnavailable:
                continue
            # Record cost AFTER success. Fire-and-forget semantics
            # via the safe wrapper — never raises, never blocks the
            # response on a tracking failure.
            if service is not None:
                llm_cost.record_llm_call_safe(
                    service, provider.model, input_tokens, output_tokens,
                )
            return text, provider.name

    raise NXSoulsAllProvidersFailed("all_providers_exhausted")
