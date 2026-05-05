"""Sprkls — visual_metadata generator.

Each action_type carries a small JSON blob with the parameters the
frontend needs to render the effect (Phase 4.2 SprklsLayer). The
shapes here are the contract between this backend and that future
frontend; if a field is renamed / added / removed, both sides have
to move together.

All randomisation is bounded to safe values — graffiti positions
avoid the taskbar (bottom 60px) and the desktop-icon column
(left ~88px) to reduce the chance of a sprkl landing on top of an
interactive control.
"""

from __future__ import annotations

import random
from typing import Final, Mapping

# ── Per-archetype graffiti palettes ──────────────────────────────────
#
# Picked to read at-a-glance which Dev painted what. INFLUENCER pink
# vs DEGEN green vs FED red etc. — the hue is the visual signature.
_GRAFFITI_PALETTES: Final[Mapping[str, tuple[str, ...]]] = {
    "INFLUENCER":    ("#ff4d8f", "#ff66b2", "#e91e63"),
    "DEGEN":         ("#22c55e", "#16a34a", "#10b981"),
    "10X_DEV":       ("#1f2937", "#374151", "#4b5563"),
    "GRINDER":       ("#3b82f6", "#2563eb", "#1d4ed8"),
    "FED":           ("#dc2626", "#b91c1c", "#ef4444"),
    "SCRIPT_KIDDIE": ("#a855f7", "#9333ea", "#7c3aed"),
    "HACKTIVIST":    ("#16a34a", "#166534", "#14532d"),  # subdued green
    "LURKER":        ("#6b7280", "#4b5563", "#374151"),  # gray
}

_DEFAULT_PALETTE: Final[tuple[str, ...]] = ("#6b7280", "#4b5563", "#374151")

# Frontend window IDs the WindowManager already knows about. Phase
# 4.4 will dispatch on these. Keeping the list small + matching real
# windows so we never queue up an "open Foo" sprkl for a Foo that
# doesn't exist yet.
_WINDOW_TARGETS_BY_ARCHETYPE: Final[Mapping[str, tuple[str, ...]]] = {
    "INFLUENCER":    ("notepad",),  # opens a draft to write in
    "DEGEN":         ("nxt-wallet", "protocol-market", "nxmarket"),
    "10X_DEV":       ("notepad", "nx-terminal"),
    "GRINDER":       ("notepad", "dev-camp"),
    "FED":           ("inbox",),
    "SCRIPT_KIDDIE": ("bug-sweeper", "protocol-solitaire"),
    "HACKTIVIST":    ("netwatch",),
    "LURKER":        ("recycle-bin",),
}
_DEFAULT_WINDOW_TARGETS: Final[tuple[str, ...]] = ("notepad",)

_SCREENSAVER_VARIANTS_BY_ARCHETYPE: Final[Mapping[str, tuple[str, ...]]] = {
    "INFLUENCER":    ("be_that_girl", "aesthetic_drift"),
    "DEGEN":         ("moon_soon", "candles"),
    "10X_DEV":       ("matrix_rain", "compiling"),
    "GRINDER":       ("focus_mode",),
    "FED":           ("surveillance",),
    "SCRIPT_KIDDIE": ("skibidi", "doom_mode"),
}
_DEFAULT_SCREENSAVERS: Final[tuple[str, ...]] = ("matrix_rain",)

_WALLPAPER_VARIANTS_BY_ARCHETYPE: Final[Mapping[str, tuple[str, ...]]] = {
    "INFLUENCER": ("aesthetic_pink", "soft_serve"),
    "GRINDER":    ("office_grindset", "blueprint"),
    "FED":        ("compliance_grey",),
}
_DEFAULT_WALLPAPERS: Final[tuple[str, ...]] = ("aesthetic_pink",)

_FAKE_POPUP_ICONS: Final[tuple[str, ...]] = ("warning", "info", "error")
_FAKE_POPUP_BUTTONS: Final[tuple[tuple[str, ...], ...]] = (
    ("OK",),
    ("Yes", "No"),
    ("OK", "Cancel"),
)

# Safe placement bounds (percent of viewport). The corridor avoids
# the bottom 15% (Win98 taskbar) and the left 8% (desktop icons).
# Phase 4.2 SprklsLayer should respect these; the backend just sets
# them so the frontend has a self-consistent contract.
_GRAFFITI_X_RANGE = (10, 80)
_GRAFFITI_Y_RANGE = (12, 75)
_GRAFFITI_ROTATION_RANGE = (-8, 8)
_GRAFFITI_FONT_SIZE_RANGE = (24, 40)


def _pick(seq: tuple[str, ...]) -> str:
    """Wrapper around random.choice that's safe on empty input — the
    fallback maps above guarantee non-empty, but defending against
    a future regression that hands in an empty tuple."""
    if not seq:
        return ""
    return random.choice(seq)


def generate_visual_metadata(action_type: str, archetype: str) -> dict:
    """Return the visual_metadata JSONB blob for one sprkl.

    Each action_type produces a different shape. The shapes here
    define the wire contract for Phase 4.2 SprklsLayer — when adding
    a new field, the frontend has to learn it before this PR ships,
    or the field is purely additive (frontend ignores unknown keys).
    """
    if action_type == "toast":
        return {"duration_ms": 8000}

    if action_type == "graffiti":
        palette = _GRAFFITI_PALETTES.get(archetype, _DEFAULT_PALETTE)
        return {
            "color": random.choice(palette),
            "position": {
                "x_pct": random.randint(*_GRAFFITI_X_RANGE),
                "y_pct": random.randint(*_GRAFFITI_Y_RANGE),
            },
            "rotation_deg": random.randint(*_GRAFFITI_ROTATION_RANGE),
            "font_size_px": random.randint(*_GRAFFITI_FONT_SIZE_RANGE),
            "font_family": "Permanent Marker",
        }

    if action_type == "window":
        targets = _WINDOW_TARGETS_BY_ARCHETYPE.get(
            archetype, _DEFAULT_WINDOW_TARGETS
        )
        return {"target": _pick(targets)}

    if action_type == "screensaver":
        variants = _SCREENSAVER_VARIANTS_BY_ARCHETYPE.get(
            archetype, _DEFAULT_SCREENSAVERS
        )
        return {"variant": _pick(variants)}

    if action_type == "wallpaper":
        variants = _WALLPAPER_VARIANTS_BY_ARCHETYPE.get(
            archetype, _DEFAULT_WALLPAPERS
        )
        return {
            "variant": _pick(variants),
            "duration_ms": 60_000,
        }

    if action_type == "desktop_file":
        # Filename comes from the content engine's template (the
        # `content` field is the filename for desktop_file sprkls);
        # visual_metadata only carries the preview blurb.
        return {
            "preview": "(double-click to peek — sprkls write spicy "
                       "files; nothing real lives here)",
        }

    if action_type == "cursor_prank":
        return {
            "duration_ms": 2000,
            "wiggle_intensity": round(random.uniform(0.4, 0.9), 2),
        }

    if action_type == "fake_popup":
        return {
            "title": "",  # filled from content at frontend time
            "icon": _pick(_FAKE_POPUP_ICONS),
            "buttons": list(random.choice(_FAKE_POPUP_BUTTONS)),
        }

    # Unknown action_type — don't crash the scheduler, just produce
    # an empty JSONB so the row is still valid.
    return {}
