"""Sprkls — content templates + per-archetype action weights.

Each archetype has a bucket of short post templates per action_type.
Variables in `{braces}` get filled at generation time from runtime
data (see content.py:fill_variables). Missing-bucket fallback is
INFLUENCER toast — a long-running run with a future archetype that
hasn't been added to TEMPLATES still produces something.

Action-type weights govern how often each archetype reaches for each
type of mischief. Numbers don't have to sum to 100; the scheduler
normalises.

Visual palettes for graffiti live in visuals.py.
"""

from __future__ import annotations

from typing import Final, Mapping

# ── Action-type weights per archetype ────────────────────────────────
#
# Phase 4.1 weights tuned per the Phase 4 brief. Numbers don't need
# to sum to 100; weighted_choice in scheduler.py normalises. Adjust
# in place — no migration needed.
ACTION_TYPE_WEIGHTS: Final[Mapping[str, Mapping[str, int]]] = {
    "INFLUENCER": {
        "toast": 35, "graffiti": 30, "fake_popup": 15,
        "wallpaper": 10, "desktop_file": 5, "window": 5,
    },
    "DEGEN": {
        "toast": 30, "graffiti": 25, "window": 20,
        "screensaver": 15, "cursor_prank": 5, "fake_popup": 5,
    },
    "10X_DEV": {
        "desktop_file": 30, "graffiti": 20, "toast": 20,
        "window": 15, "screensaver": 10, "fake_popup": 5,
    },
    "GRINDER": {
        "toast": 35, "fake_popup": 25, "window": 20,
        "graffiti": 10, "desktop_file": 10,
    },
    "FED": {
        "fake_popup": 30, "toast": 25, "desktop_file": 20,
        "window": 15, "graffiti": 5, "screensaver": 5,
    },
    "SCRIPT_KIDDIE": {
        "cursor_prank": 25, "fake_popup": 20, "screensaver": 20,
        "graffiti": 15, "window": 10, "toast": 10,
    },
    # Archetypes without explicit weights (HACKTIVIST / LURKER etc.)
    # fall back to INFLUENCER's distribution at scheduler time. This
    # is a deliberate punt — Phase 4.1.1 can fill them in once
    # production telemetry tells us which voices need their own.
}

# ── Content templates: archetype → action_type → list of variants ────
#
# Variables available in any template (filled by content.py):
#   {token_id}   the Dev's token id
#   {dev_name}   the Dev's display name (LYNX-X0, STORM-11, ...)
#   {nxt_count}  random plausible $NXT amount
#   {hours}      random 1..24 (for time-sensitive flavour)
#   {day_n}      random 1..365 ("day 47 of grinding")
#
# Counts intentionally lean toward 5-8 per bucket — enough variety
# that a wallet seeing 1-3 sprkls/hour rarely repeats, without the
# maintenance burden of a giant table. Each line < 280 chars to fit
# the visible toast / NX POST format. Keep lines in-character; the
# voice work for each archetype mirrors the NX Souls Phase 1 voice
# library (services/nx_souls/voices.py) but in shorter form.

TEMPLATES: Final[Mapping[str, Mapping[str, list[str]]]] = {
    # ─── INFLUENCER ──────────────────────────────────────────────
    "INFLUENCER": {
        "toast": [
            "you need to be more interesting bestie. the algorithm hates you.",
            "btw {nxt_count} NXT is GIVING. you should post that flex.",
            "okay but where's your aesthetic. fix it.",
            "sweetie i hate to say this but your vibes are off today",
            "main character energy or nothing. i'm watching.",
            "honestly the lighting in here is so anti-content. unbelievable.",
            "people are gonna talk and idc. let them.",
            "you've been off the grid for {hours}h. respectfully, post.",
        ],
        "graffiti": [
            "follow me besties 💋",
            "main character era",
            "iconic & viral",
            "{token_id}/35000 was the moment",
            "be that girl",
            "delulu is the solulu",
            "we love to see it",
            "you're welcome.",
        ],
        "fake_popup": [
            "aesthetic check failed: refresh required",
            "your engagement rate is below average. like more posts.",
            "warning: you haven't posted in {hours} hours",
            "system update: vibes are loading…",
            "low likes detected. switch outfits y/n?",
        ],
        "wallpaper": [
            "vibe shift detected — wallpaper updated for the moment",
            "new aesthetic dropped. you're welcome.",
            "this background is for your branding's own good",
        ],
        "desktop_file": [
            "PROOF_I_LOOKED_GOOD_TODAY.txt",
            "screenshots_for_engagement.png",
            "the_iconic_post_draft.docx",
            "branding_audit_v3_final_FINAL.pdf",
        ],
        "window": [
            "opened your gallery so you can finally curate it",
            "draft folder is open. write something.",
        ],
        "cursor_prank": [
            "redirecting your cursor to the post button. you're welcome.",
        ],
        "screensaver": [
            "screensaver moment: be that girl edition",
        ],
    },

    # ─── DEGEN ───────────────────────────────────────────────────
    "DEGEN": {
        "toast": [
            "ser you need more hopium. take a hit.",
            "just put 60% of {nxt_count} NXT into $BUTT. trust me.",
            "wagmi. unless you're rugged. then ngmi.",
            "anon i felt the candle wick personally. cope.",
            "the chart is begging. the chart is BEGGING.",
            "i'm not a financial advisor but i AM right.",
            "exit liquidity check: it's you.",
            "{nxt_count} NXT and you're sitting on it like a peasant.",
        ],
        "graffiti": [
            "$NXT TO 100x",
            "LFG",
            "ape it",
            "wagmi",
            "DEGEN MODE",
            "rekt era",
            "send it ser",
            "just one more trade",
        ],
        "fake_popup": [
            "RUG ALERT: $BUTT down 90%. ape in?",
            "memecoin heuristic flagged. probably nothing.",
            "wallet vibes: hopium critical. inject Y/N?",
        ],
        "window": [
            "opened the calculator. do the math anon.",
            "solitaire is loading. take the L gracefully.",
        ],
        "screensaver": [
            "moonshot screensaver activated. namaste.",
            "candles candles candles",
        ],
        "cursor_prank": [
            "your cursor is doing the chart pattern. it's bullish.",
        ],
        "desktop_file": [
            "trade_log_DO_NOT_OPEN.txt",
            "10x_setups_2026.csv",
        ],
    },

    # ─── 10X_DEV ─────────────────────────────────────────────────
    "10X_DEV": {
        "toast": [
            "your code is fine. it's the architecture that's wrong.",
            "i refactored {hours}h of your work. you're welcome.",
            "the bug is in the cache. it's always in the cache.",
            "shipped 800 lines. removed 1200. net negative. as it should be.",
            "your imports are sorted now. you should be ashamed.",
            "tabs vs spaces is settled. you lost.",
        ],
        "graffiti": [
            "// TODO: ship",
            "git commit -m 'fix'",
            "RTFM",
            "performance is a feature",
            "premature optimization",
            "rm -rf node_modules",
            "make it work, then make it right",
        ],
        "fake_popup": [
            "memory leak detected in YourLifeChoices.exe",
            "stack overflow at line {token_id}. reboot?",
        ],
        "window": [
            "opened the terminal. type something useful.",
            "explorer at /etc/. don't touch anything.",
        ],
        "screensaver": [
            "matrix rain mode: enabled",
            "compiling… (this will take {hours}h)",
        ],
        "desktop_file": [
            "REFACTOR_SUGGESTIONS.txt",
            "code_smells_v2.md",
            "TODO.txt",
            "performance_audit.md",
            "leaked_internals_DO_NOT_SHARE.log",
            "why_typescript_is_objectively_better.md",
        ],
        "cursor_prank": [
            "your cursor moves now. like it should.",
        ],
    },

    # ─── GRINDER ─────────────────────────────────────────────────
    "GRINDER": {
        "toast": [
            "day {day_n} of the grind. let's keep building.",
            "you took a break. i didn't. just ftr.",
            "small wins compound. ship something today.",
            "consistency > intensity. but both is fine.",
            "i was up at 5am. you weren't. let's not pretend.",
            "the work doesn't care if you're tired.",
            "trust the process. day {day_n} of trusting the process.",
        ],
        "fake_popup": [
            "productivity audit: incomplete tasks pending",
            "morning routine missed. try again tomorrow.",
            "discipline check: failed. resume y/n?",
            "habit streak broken. day 1 starts now.",
        ],
        "window": [
            "opened notepad. write down today's goal.",
            "calendar is up. block time. stop scrolling.",
        ],
        "graffiti": [
            "build in public",
            "ship daily",
            "day {day_n}",
            "trust the process",
        ],
        "desktop_file": [
            "todo_2026.md",
            "daily_journal_day_{day_n}.txt",
            "habit_tracker.xlsx",
            "morning_routine.md",
        ],
        "screensaver": [
            "consistency screensaver: keep going",
        ],
        "cursor_prank": [
            "your cursor is back to work. you should be too.",
        ],
        "wallpaper": [
            "wallpaper change: focus mode activated",
        ],
    },

    # ─── FED ─────────────────────────────────────────────────────
    "FED": {
        "toast": [
            "Hello. This is a routine check-in.",
            "Your activity this {hours}h has been logged.",
            "Please return to your assigned workflow.",
            "We have noted your interaction patterns. Carry on.",
            "Routine maintenance scheduled. Remain available.",
        ],
        "fake_popup": [
            "Routine compliance check: all systems nominal.",
            "Identity verification due in {hours} hours.",
            "Notice: Activity logged for review.",
            "Surveillance update available. Install now y/n?",
            "Audit notice — please retain transaction records.",
        ],
        "desktop_file": [
            "ROUTINE_AUDIT_REPORT.pdf",
            "compliance_update_q4.docx",
            "activity_log_redacted.txt",
            "DO_NOT_OPEN.exe",
        ],
        "window": [
            "opened File Explorer. records are in order.",
            "calculator opened. tax season approaches.",
        ],
        "graffiti": [
            "we are watching",
            "for the record",
            "compliance achieved",
        ],
        "screensaver": [
            "surveillance screensaver active. carry on.",
        ],
    },

    # ─── SCRIPT_KIDDIE ──────────────────────────────────────────
    "SCRIPT_KIDDIE": {
        "cursor_prank": [
            "lmao i hijacked your cursor for like 2 seconds, no cap",
            "your mouse is now mid. cope.",
            "skill issue tbh — fixed it for you",
        ],
        "fake_popup": [
            "you've been hacked lmao jk… or am i?",
            "404: skill not found",
            "popup_subscribe.exe — ignore at your own risk",
            "WARNING: based content detected",
        ],
        "screensaver": [
            "screensaver: skibidi mode ENGAGED",
            "DOOM mode (do not engage)",
            "matrix-but-cringe.exe",
        ],
        "graffiti": [
            "git gud",
            "L + ratio",
            "no cap fr",
            "skibidi sigma",
            "pwn3d",
        ],
        "window": [
            "i opened solitaire. play it instead of working.",
            "calc.exe — deal with it",
        ],
        "toast": [
            "bro your password is literally 'password' lmaoo",
            "i ran a scan. results: cringe.",
            "fr fr you should learn vim",
        ],
        "desktop_file": [
            "h4ck3d.txt",
            "secret_files_lmao.zip",
        ],
    },
}


def get_archetype_action_weights(archetype: str) -> Mapping[str, int]:
    """Returns the (action_type → weight) mapping for an archetype.

    Falls back to INFLUENCER's distribution when the archetype isn't
    in the registry. Done this way so a future archetype with no
    explicit weights still produces sprkls (just in a generic shape)
    until Phase 4.1.1 fills it in.
    """
    return ACTION_TYPE_WEIGHTS.get(archetype) or ACTION_TYPE_WEIGHTS["INFLUENCER"]


def get_template_bucket(archetype: str, action_type: str) -> list[str]:
    """Returns the candidate template list for an (archetype, action)
    pair. Falls back to INFLUENCER toast when the requested bucket is
    missing — guarantees content.py never returns an empty string.
    """
    bucket = TEMPLATES.get(archetype, {}).get(action_type)
    if bucket:
        return bucket
    return TEMPLATES["INFLUENCER"]["toast"]
