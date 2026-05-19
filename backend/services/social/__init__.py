"""Social-vitality module — shared rules for awarding the social stat.

Previously lived inline in engine.py. Lifted to a package so the posts
generator (and any future social-source — shop items, missions, etc.)
can reuse the same cap + per-archetype gain table without duplication.
"""

from backend.services.social.vitality import (
    SOCIAL_VITALITY_CAP_CHAT_POST,
    SOCIAL_VITALITY_GAIN,
    _apply_social_vitality_gain,
)

__all__ = [
    "SOCIAL_VITALITY_CAP_CHAT_POST",
    "SOCIAL_VITALITY_GAIN",
    "_apply_social_vitality_gain",
]
