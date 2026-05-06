"""NX POST — Phase 5.1 backend foundation.

Public surface (intentionally narrow):

  - run_feed_generation_tick
      Engine-loop entry point. The engine main loop in
      backend/engine/engine.py invokes this on its own cadence
      (1h) the same way it invokes run_sprkls_tick.

  - extract_hashtags / extract_mentions / extract_tickers
      Text-parsing helpers exposed for tests and any future
      route-side use (e.g. computing metadata for manually-authored
      posts in Phase 5.x).

Topic data (WEEKLY_TOPICS / ARCHETYPE_VOICE) lives in topics.py and
is imported by the generator internally; consumers should not depend
on the raw constants here.
"""

from backend.services.posts.generator import (
    extract_hashtags,
    extract_mentions,
    extract_tickers,
    generate_feed_post_for_dev,
    run_feed_generation_tick,
)

__all__ = [
    "run_feed_generation_tick",
    "generate_feed_post_for_dev",
    "extract_hashtags",
    "extract_mentions",
    "extract_tickers",
]
