/**
 * SprklWindow — side-effect dispatcher for action_type='window'.
 *
 * Renders no visible UI. On mount it fires a CustomEvent on
 * `window` that <Desktop> listens for, then immediately calls
 * onDismiss so the sprkl row is gone from the next /sprkls/recent
 * fetch (and from local state via the hook's optimistic dismiss
 * path).
 *
 * Why CustomEvent instead of importing useWindowManager:
 *   useWindowManager is called inside <Desktop>; its `openWindow`
 *   is component-local state, not a global. <SprklsLayer> is a
 *   SIBLING of <Desktop> in App.jsx, so it can't reach openWindow
 *   without one of:
 *     - lifting useWindowManager up to App.jsx (heavy refactor)
 *     - threading openWindow via context (creates a new context for
 *       a single use-case)
 *     - browser-event bridge (this — additive, zero refactor of
 *       WindowManager, easy to remove if a Phase 4.x consolidates
 *       the contexts)
 *
 * Target validation:
 *   The alias map covers the brief's wording-level differences
 *   (the brief mentioned "solitaire" / "calculator" / "explorer"
 *   etc.; the real WindowManager uses ids like "protocol-solitaire"
 *   / "nx-terminal" / "recycle-bin"). Unknown targets after alias
 *   resolution are logged and dismissed without opening — better a
 *   silent miss than a janky empty 600×400 stub window from
 *   useWindowManager's fallback path.
 *
 *   When the backend visuals.py adds a new target, it should be
 *   either (a) an existing WindowManager id (no change here), or
 *   (b) added to KNOWN_TARGETS / TARGET_ALIASES below.
 */

import { useEffect, useRef } from 'react';

// Targets the sprkls system is allowed to open. Sourced from
// useWindowManager's WINDOW_DEFAULTS keys as of Phase 4.4. If a
// future window id lands there, add it here too. Conservative by
// design: a sprkl can't pop random / sensitive surfaces (e.g.
// 'admin', 'mossadmin', etc.) even if a backend bug emits them.
export const KNOWN_TARGETS = new Set([
  'notepad',
  'protocol-solitaire',
  'bug-sweeper',
  'nxt-wallet',
  'protocol-market',
  'nxmarket',
  'nx-terminal',
  'dev-camp',
  'inbox',
  'netwatch',
  'recycle-bin',
  'live-feed',
  'world-chat',
  'leaderboard',
  'ai-lab',
  'my-devs',
  'corp-wars',
  'mission-control',
  'achievements',
  'monad-city',
  'dev-academy',
  'mega-sentinel',
]);

// Wording aliases — the brief mentioned a few targets that don't
// match real WindowManager ids one-for-one. Translate here so the
// scheduler can use natural English without us forcing a backend
// migration. Unknown post-alias targets get rejected.
const TARGET_ALIASES = {
  solitaire:  'protocol-solitaire',
  bugsweeper: 'bug-sweeper',
  // Intentionally NOT mapped (no analog window in the desktop):
  //   calculator, explorer, chogpet
  // Sprkls naming these will be logged + dismissed.
};

/**
 * Custom-event name used to signal a window-open request from any
 * surface to <Desktop>. Exported so the listener side can use the
 * same constant rather than duplicating the string.
 */
export const SPRKLS_OPEN_WINDOW_EVENT = 'sprkls:open-window';

export default function SprklWindow({ sprkl, onDismiss }) {
  // useRef gates the effect to a single fire even under React 19
  // StrictMode's double-invoke. Without this, the second invocation
  // would dispatch two events and leave a duplicate-target window
  // open (or, worse, race the dismiss).
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    const rawTarget = sprkl?.visual_metadata?.target;
    if (!rawTarget) {
      // eslint-disable-next-line no-console
      console.warn('[SprklWindow] missing target on sprkl', sprkl?.id);
      onDismiss();
      return;
    }

    // Resolve aliases first, then validate.
    const target = TARGET_ALIASES[rawTarget] || rawTarget;
    if (!KNOWN_TARGETS.has(target)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[SprklWindow] unknown target — refusing to open',
        { sprkl_id: sprkl?.id, raw: rawTarget, resolved: target }
      );
      onDismiss();
      return;
    }

    try {
      // CustomEvent bubbles by default; bubbles:true is harmless
      // here because window doesn't bubble further but explicit is
      // clearer than relying on the default.
      window.dispatchEvent(
        new CustomEvent(SPRKLS_OPEN_WINDOW_EVENT, {
          detail: { id: target, sprkl_id: sprkl.id },
        })
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SprklWindow] dispatch failed', e);
    } finally {
      // Always dismiss, success or fail — the action either fired
      // (user has a visible window now) or it didn't (logging is
      // the only remaining surface). Either way the sprkl row is
      // no longer needed and a stale row would re-fire on the next
      // poll.
      onDismiss();
    }
  }, [sprkl?.id, onDismiss]);

  return null;
}
