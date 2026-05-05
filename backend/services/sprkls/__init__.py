"""Sprkls — Phase 4.1 backend foundation.

Public surface (intentionally narrow):

  - run_sprkls_tick / cleanup_expired_posts
      Engine-loop entry points. The engine main loop in
      backend/engine/engine.py invokes these on their own cadences
      (5min / 1h respectively) the same way it invokes existing
      periodic jobs like process_pending_funds.

  - is_in_sprkls_beta
      Backend mirror of the frontend allowlist (config/betaFeatures.js)
      so the scheduler skips wallets that don't yet have the UI
      surface. Visibility-only gate; nothing else gates it.

Templates / content / visuals submodules are imported by the
scheduler internally; consumers should not depend on them directly.
"""

from backend.services.sprkls.beta import is_in_sprkls_beta
from backend.services.sprkls.scheduler import (
    cleanup_expired_posts,
    run_sprkls_tick,
)

__all__ = [
    "is_in_sprkls_beta",
    "run_sprkls_tick",
    "cleanup_expired_posts",
]
