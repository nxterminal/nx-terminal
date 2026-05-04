"""NX Souls — domain exceptions.

Kept in their own module so callers (route handlers, tests) can import
them without pulling in the LLM router's heavy dependency surface.
"""

from __future__ import annotations


class NXSoulsError(Exception):
    """Base for all NX Souls errors."""


class NXSoulsAllProvidersFailed(NXSoulsError):
    """Every LLM provider in the cascade failed (rate-limited, timed out,
    network error, or auth error). Phase 2 will translate this into
    an automatic sleep transition; Phase 1 surfaces it as 503 to the
    caller.
    """


class NXSoulsProviderUnavailable(NXSoulsError):
    """A specific provider is not configured (missing API key) or has
    been disabled at startup. Used internally by the router to skip
    that provider in the cascade.
    """
