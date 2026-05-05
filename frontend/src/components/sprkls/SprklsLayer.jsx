/**
 * SprklsLayer — chrome-floating container for sprkls.
 *
 * Mounted unconditionally in App.jsx. The beta gate +
 * walletAddress check inside this component returns null when the
 * user shouldn't see anything — non-beta wallets pay zero render
 * cost and the polling never starts.
 *
 * Visual surfaces (one hook, one authoritative `dismiss`):
 *
 *   1. Toasts (Phase 4.2) — bottom-right column, MAX 3 visible,
 *      auto-dismiss after visual_metadata.duration_ms.
 *   2. Graffiti (Phase 4.3) — viewport overlay, absolutely
 *      positioned per visual_metadata.position. NO auto-dismiss.
 *   3. Window (Phase 4.4) — fires a CustomEvent that <Desktop>
 *      routes to openWindow. No visible element of its own; emits
 *      a brief companion toast for context.
 *   4. fake_popup (Phase 4.5a) — centered Win98 dialog. ONE at a
 *      time; queue advances on dismiss. 12s auto-dismiss.
 *   5. desktop_file (Phase 4.5a) — fake "file dropped" icon at
 *      backend-provided position. Click → preview modal. NO
 *      auto-dismiss; persists until explicit X / Delete.
 *   6. cursor_prank (Phase 4.5a) — body-cursor swap + fake-cursor
 *      wiggle. ONE at a time; queue advances on dismiss. Auto-
 *      dismiss after duration_ms (default 2s).
 *
 * Phase 4.5b will surface screensaver / wallpaper.
 *
 * Layer ordering (z-index):
 *   - Desktop / WindowManager: ≤ 100s
 *   - desktop_file layer: 9200
 *   - graffiti layer:     9300
 *   - fake_popup layer:   9400
 *   - toast layer:        9500
 *   - cursor_prank fake:  9700
 *   - NX Souls modal:     9999
 *   - NewChatPicker:     10001
 *
 * Phase 4.4 / 4.5a defensive UX:
 *   - Window: at most ONE per polling cycle (60s) + drop >24h.
 *   - fake_popup, cursor_prank: ONE at a time on screen; the rest
 *     queue silently and mount when the visible one dismisses.
 *   - When any of {window, fake_popup, desktop_file, cursor_prank}
 *     fires, an ephemeral local toast spawns alongside it so the
 *     user has visible context for the action. The local toasts
 *     live only in this component's state and never round-trip to
 *     the backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { useSprkls } from '../../hooks/useSprkls';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import SprklToast from './SprklToast';
import SprklGraffiti from './SprklGraffiti';
import SprklWindow from './SprklWindow';
import SprklFakePopup from './SprklFakePopup';
import SprklDesktopFile from './SprklDesktopFile';
import SprklCursorPrank from './SprklCursorPrank';
import styles from './sprkls.module.css';

const MAX_VISIBLE_TOASTS = 3;

// Phase 4.4 rate-limit + staleness rules. The polling cycle is 60s
// (POLL_INTERVAL_MS in useSprkls); the rate limit matches that
// interval so each cycle has the chance to fire at most one window
// action. STALE_THRESHOLD covers the most common abuse / glitch
// scenario: user offline overnight, comes back, the queue is full
// of stale window sprkls that should NOT pop programs hours later.
const WINDOW_RATE_LIMIT_MS = 60_000;
const WINDOW_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h
const COMPANION_TOAST_DURATION_MS = 5_000;

// Companion-toast wording per target. Keys match KNOWN_TARGETS in
// SprklWindow.jsx. Anything outside this map falls back to a
// generic "{name} opened {target}" line below.
const COMPANION_TOAST_BY_TARGET = {
  notepad:              (n) => `${n} opened Notepad — write something down`,
  'protocol-solitaire': (n) => `${n} opened Solitaire to take a break`,
  'bug-sweeper':        (n) => `${n} hijacked Bug Sweeper`,
  'nxt-wallet':         (n) => `${n} opened your NXT Wallet`,
  'protocol-market':    (n) => `${n} is checking the Protocol Market`,
  nxmarket:             (n) => `${n} pulled up NX Market`,
  'nx-terminal':        (n) => `${n} opened the terminal`,
  'dev-camp':           (n) => `${n} opened Dev Camp`,
  inbox:                (n) => `${n} is reading your inbox`,
  netwatch:             (n) => `${n} fired up MegaWatch`,
  'recycle-bin':        (n) => `${n} is rooting through the Recycle Bin`,
};

// Phase 4.5a — companion-toast wording per non-window action_type.
// The fake_popup / desktop_file / cursor_prank surfaces are largely
// self-narrating (the popup's title, the filename, the wiggling
// cursor) but a brief contextual toast tells the user WHICH Dev did
// it, matching the pattern Phase 4.4 set for window actions.
const COMPANION_TOAST_BY_ACTION = {
  fake_popup:    (n) => `${n} is throwing system errors at you`,
  desktop_file:  (n) => `${n} just dropped a file on your desktop`,
  cursor_prank:  (n) => `${n} is messing with your cursor`,
};

function composeWindowCompanionContent(devName, target) {
  const fn = COMPANION_TOAST_BY_TARGET[target];
  const name = devName || 'A Dev';
  if (fn) return fn(name);
  return `${name} opened ${target}`;
}

function composeActionCompanionContent(devName, actionType) {
  const fn = COMPANION_TOAST_BY_ACTION[actionType];
  const name = devName || 'A Dev';
  return fn ? fn(name) : `${name} did something`;
}

function ageMs(sprkl) {
  // created_at comes back from the backend as an ISO string. Date
  // accepts both ISO and ms-numbers; defensive parse so a
  // malformed or missing field treats the row as fresh (we'd
  // rather pop the program than auto-dismiss a brand-new sprkl
  // because of a parsing edge case).
  const t = sprkl?.created_at ? new Date(sprkl.created_at).getTime() : Date.now();
  if (Number.isNaN(t)) return 0;
  return Date.now() - t;
}

export default function SprklsLayer() {
  const { address } = useWallet();
  const { openChatModal } = useChatModal();
  const isBeta = isInNXSoulsBeta(address);

  const { sprkls, dismiss } = useSprkls(address, { enabled: isBeta });

  // Phase 4.4 — rate-limit + ephemeral toast queue.
  // lastWindowFiredAtRef is a Date.now() timestamp; 0 means "never
  // fired this session". Survives re-renders without retriggering
  // useEffects — we just read/write it directly.
  const lastWindowFiredAtRef = useRef(0);
  const [localToasts, setLocalToasts] = useState([]);

  // Stable callback for the ephemeral-toast dismiss path. Different
  // identity from the hook's `dismiss` so SprklToast can route
  // dismissal through the right channel without inspecting the
  // sprkl shape itself.
  const dismissEphemeralToast = useCallback((localId) => {
    setLocalToasts((prev) => prev.filter((t) => t.id !== localId));
  }, []);

  // Bucket the feed by action_type. Other types (screensaver /
  // wallpaper) pass through unchanged but render nothing here —
  // Phase 4.5b.
  const toastSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'toast'),
    [sprkls]
  );
  const graffitiSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'graffiti'),
    [sprkls]
  );
  const windowSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'window'),
    [sprkls]
  );
  const fakePopupSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'fake_popup'),
    [sprkls]
  );
  const desktopFileSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'desktop_file'),
    [sprkls]
  );
  const cursorPrankSprkls = useMemo(
    () => sprkls.filter((s) => s.action_type === 'cursor_prank'),
    [sprkls]
  );

  // Stale-dismissal pass. Runs whenever the window-sprkl set
  // changes; any row older than the threshold gets dismissed
  // server-side WITHOUT opening the program. Best-effort — if the
  // dismiss POST fails, the next poll re-surfaces the row and we
  // try again.
  useEffect(() => {
    for (const s of windowSprkls) {
      if (ageMs(s) > WINDOW_STALE_THRESHOLD_MS) {
        // eslint-disable-next-line no-console
        console.info(
          '[SprklsLayer] dropping stale window sprkl',
          { id: s.id, age_hours: Math.round(ageMs(s) / 3_600_000) }
        );
        dismiss(s.id);
      }
    }
  }, [windowSprkls, dismiss]);

  // Pick the next non-stale window sprkl to fire, respecting the
  // 60s rate limit. Returning null means "skip this render"; the
  // next poll cycle (or the next dismiss-driven re-render) will
  // re-evaluate.
  const windowToFire = useMemo(() => {
    if (Date.now() - lastWindowFiredAtRef.current < WINDOW_RATE_LIMIT_MS) {
      return null;
    }
    return (
      windowSprkls.find((s) => ageMs(s) <= WINDOW_STALE_THRESHOLD_MS) || null
    );
  }, [windowSprkls]);

  // Phase 4.5a — queue selection for one-at-a-time surfaces. The
  // backend returns the feed sorted by created_at DESC, so [0] is
  // always the freshest. When the visible row dismisses, the
  // optimistic-remove in useSprkls drops it from local state and
  // [1] becomes the new [0] on the next render — natural FIFO of
  // newest-first.
  const visibleFakePopup = fakePopupSprkls[0] || null;
  const visibleCursorPrank = cursorPrankSprkls[0] || null;

  // ── Companion-toast helpers ───────────────────────────────────────

  // Append an ephemeral local toast. Used by the on-mount callbacks
  // of SprklWindow / SprklFakePopup / SprklDesktopFile /
  // SprklCursorPrank to add the contextual "X did something" line.
  const appendLocalToast = useCallback((sprkl, content) => {
    setLocalToasts((prev) => [
      {
        id: `local-${sprkl.action_type}-${sprkl.id}-${Date.now()}`,
        token_id: sprkl.token_id,
        name: sprkl.name,
        archetype: sprkl.archetype,
        ipfs_image: sprkl.ipfs_image,
        content,
        action_type: 'toast',
        visual_metadata: { duration_ms: COMPANION_TOAST_DURATION_MS },
        _ephemeral: true,
      },
      ...prev,
    ]);
  }, []);

  // Called by SprklWindow's onDismiss — also seeds the companion
  // toast and stamps the rate-limit ref so subsequent renders
  // within the next 60s skip new windows.
  const handleWindowFired = useCallback(
    (sprkl) => {
      lastWindowFiredAtRef.current = Date.now();
      const target =
        sprkl.visual_metadata?.target || 'an unknown program';
      const content = composeWindowCompanionContent(sprkl.name, target);
      appendLocalToast(sprkl, content);
      dismiss(sprkl.id);
    },
    [appendLocalToast, dismiss]
  );

  // Phase 4.5a — generic onMount handler for the three new
  // surfaces. Each child component fires this once on mount (gated
  // by its own hasFiredRef so StrictMode's double-invoke doesn't
  // produce duplicate toasts). Identity is stable because
  // appendLocalToast is memoised.
  const handleNonWindowMount = useCallback(
    (sprkl) => {
      const content = composeActionCompanionContent(
        sprkl.name,
        sprkl.action_type
      );
      appendLocalToast(sprkl, content);
    },
    [appendLocalToast]
  );

  if (!isBeta || !address) return null;

  // Toast stack: ephemeral local toasts FIRST so they're visually
  // co-located with the action that spawned them; backend toasts
  // after. MAX_VISIBLE_TOASTS caps the on-screen stack overall;
  // older ones queue silently.
  const allToasts = [...localToasts, ...toastSprkls];
  const visibleToasts = allToasts.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <>
      {/* desktop_file layer — z-index 9200, BELOW graffiti so files
          read as "stuck to the desktop" and graffiti reads as
          "painted on the surface above". Layer respects the
          taskbar safe-area like the graffiti layer. */}
      <div className={styles.sprklsDesktopFileLayer}>
        {desktopFileSprkls.map((sprkl) => (
          <SprklDesktopFile
            key={sprkl.id}
            sprkl={sprkl}
            onDismiss={() => dismiss(sprkl.id)}
            onMount={handleNonWindowMount}
          />
        ))}
      </div>

      <div className={styles.sprklsGraffitiLayer}>
        {graffitiSprkls.map((sprkl) => (
          <SprklGraffiti
            key={sprkl.id}
            sprkl={sprkl}
            onDismiss={() => dismiss(sprkl.id)}
          />
        ))}
      </div>

      {/* fake_popup layer — z-index 9400, between graffiti (9300)
          and toasts (9500). Layer is fixed-fullscreen with
          pointer-events: none; the popup itself sits centered and
          re-enables pointer events for its own surface. */}
      <div className={styles.sprklsFakePopupLayer}>
        {visibleFakePopup && (
          <SprklFakePopup
            key={visibleFakePopup.id}
            sprkl={visibleFakePopup}
            onDismiss={() => dismiss(visibleFakePopup.id)}
            onMount={handleNonWindowMount}
          />
        )}
      </div>

      <div className={styles.sprklsLayer}>
        {visibleToasts.map((sprkl) => {
          const isEphemeral = sprkl._ephemeral === true;
          return (
            <SprklToast
              key={sprkl.id}
              sprkl={sprkl}
              onDismiss={
                isEphemeral
                  ? () => dismissEphemeralToast(sprkl.id)
                  : () => dismiss(sprkl.id)
              }
              onClick={
                // Clicking an ephemeral toast still opens the chat
                // with the Dev that triggered it (token_id was
                // copied at spawn time). Same UX as a real toast —
                // makes the companion notification feel cohesive.
                () => openChatModal(sprkl.token_id)
              }
            />
          );
        })}
      </div>

      {/* Window-action dispatcher. Renders no UI; mounting it fires
          a CustomEvent that <Desktop> routes to openWindow. Only
          one is ever mounted per cycle; the rate limit on
          windowToFire above is the gate. */}
      {windowToFire && (
        <SprklWindow
          key={windowToFire.id}
          sprkl={windowToFire}
          onDismiss={() => handleWindowFired(windowToFire)}
        />
      )}

      {/* cursor_prank — fake cursor + body-cursor swap. The fake
          cursor element handles its own z-index; this surface
          renders only when there's a prank to run, so an idle
          state has zero footprint. ONE at a time on purpose: two
          overlapping pranks would double the wiggle and stack the
          body-cursor: none overrides. */}
      {visibleCursorPrank && (
        <SprklCursorPrank
          key={visibleCursorPrank.id}
          sprkl={visibleCursorPrank}
          onDismiss={() => dismiss(visibleCursorPrank.id)}
          onMount={handleNonWindowMount}
        />
      )}
    </>
  );
}
