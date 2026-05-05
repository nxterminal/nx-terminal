/**
 * SprklScreensaver — fullscreen archetype-themed takeover.
 *
 * Phase 4.5b surface for sprkls with `action_type='screensaver'`. A
 * single overlay covers the viewport with archetype-flavored motion;
 * the user can dismiss anytime with mousemove (after a 500ms grace),
 * click, or Escape. Auto-dismiss after `visual_metadata.duration_ms`
 * (default 30s).
 *
 * Z-index 9600: above all other sprkl surfaces but BELOW the NX
 * Souls modal (9999) so the user can keep chatting if the modal
 * happens to be open. SprklsLayer additionally short-circuits the
 * render when the chat modal is open, treating the moment as
 * passed — see SprklsLayer.jsx for that defensive path.
 *
 * Mousemove grace period: opening a screensaver right under a
 * moving cursor would dismiss instantly. The 500ms grace lets the
 * user see what arrived before any natural cursor twitch kills it.
 *
 * StrictMode gate: hasFiredRef prevents the onMount companion
 * callback from firing twice under React 19's intentional
 * double-invoke. The dismiss timer is naturally idempotent
 * (clearTimeout in cleanup) so it doesn't need its own gate.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './sprkls.module.css';

const DEFAULT_DURATION_MS = 30_000;
const MOUSE_GRACE_MS = 500;
const FADE_OUT_MS = 500;

// Archetype → CSS variant class. Backend visual_metadata.variant is
// a finer flavor (e.g. moon_soon vs candles for DEGEN); we render
// the same base treatment per archetype for now and expose `variant`
// to a content-text branch where it differs visibly. Adding per-
// variant visuals later only needs CSS additions, no JSX changes.
const VARIANT_CLASS_BY_ARCHETYPE = {
  DEGEN:         styles.sprklScreensaver_degen,
  INFLUENCER:    styles.sprklScreensaver_influencer,
  '10X_DEV':     styles.sprklScreensaver_dev,
  FED:           styles.sprklScreensaver_fed,
  SCRIPT_KIDDIE: styles.sprklScreensaver_scriptKiddie,
  GRINDER:       styles.sprklScreensaver_grinder,
};

// Per-archetype default phrase. The brief allows
// visual_metadata.phrase to override; if the backend ever wires
// that up we honor it without code changes here.
const DEFAULT_PHRASE_BY_ARCHETYPE = {
  DEGEN:         'MOON SOON',
  INFLUENCER:    'BE THAT GIRL',
  '10X_DEV':     '> compiling...',
  FED:           'RECORDING',
  SCRIPT_KIDDIE: 'INSTALLING VIRUS...',
  GRINDER:       'HUSTLE NEVER STOPS',
};

function DegenContent({ phrase }) {
  // Eight candles drifting upward at staggered offsets. CSS handles
  // the rise + fade animation; JSX just seeds the positions.
  const candles = Array.from({ length: 8 }, (_, i) => i);
  return (
    <>
      <div className={styles.sprklScreensaverDegenCandles} aria-hidden="true">
        {candles.map((i) => (
          <div
            key={i}
            className={styles.sprklScreensaverDegenCandle}
            style={{
              left: `${(i * 13 + 5) % 95}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>
      <div className={styles.sprklScreensaverDegenMarquee}>
        <span>{phrase} · {phrase} · {phrase} · {phrase} · </span>
      </div>
    </>
  );
}

function InfluencerContent({ phrase }) {
  return (
    <div className={styles.sprklScreensaverInfluencerStage}>
      <div className={styles.sprklScreensaverInfluencerText}>{phrase}</div>
    </div>
  );
}

// Lines cycle through expanding "code" so the screensaver feels
// like a build log. Loop is contained in CSS via animation-iteration-
// count: infinite on the wrapper.
const DEV_CODE_LINES = [
  "console.log('hello world');",
  "function factorial(n) {",
  "  return n <= 1 ? 1 : n * factorial(n - 1);",
  "}",
  "// shipping",
  "const $$$ = await deploy();",
  "if ($$$ > 0) ship();",
  "// 10x and counting",
];

function DevContent({ phrase }) {
  return (
    <div className={styles.sprklScreensaverDevStage}>
      <pre className={styles.sprklScreensaverDevCode} aria-hidden="true">
        {DEV_CODE_LINES.map((line, i) => (
          <span
            key={i}
            className={styles.sprklScreensaverDevLine}
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            {line}
          </span>
        ))}
      </pre>
      <div className={styles.sprklScreensaverDevPrompt}>{phrase}</div>
    </div>
  );
}

function FedContent({ phrase }) {
  // 3x3 grid of "surveillance" lenses. Each rotates at a slightly
  // different rate (CSS animation-duration variation via inline
  // style) so the grid feels organic.
  const lenses = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div className={styles.sprklScreensaverFedStage}>
      <div className={styles.sprklScreensaverFedGrid} aria-hidden="true">
        {lenses.map((i) => (
          <svg
            key={i}
            className={styles.sprklScreensaverFedLens}
            viewBox="0 0 64 64"
            style={{ animationDuration: `${4 + (i % 3)}s` }}
          >
            <circle cx="32" cy="32" r="28" fill="#1a0000" stroke="#dc2626" strokeWidth="2" />
            <circle cx="32" cy="32" r="14" fill="#330000" stroke="#dc2626" strokeWidth="1" />
            <circle cx="32" cy="32" r="5" fill="#dc2626" />
            <line x1="32" y1="6"  x2="32" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
            <line x1="6"  y1="32" x2="58" y2="32" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
          </svg>
        ))}
      </div>
      <div className={styles.sprklScreensaverFedRecording}>● {phrase}</div>
    </div>
  );
}

function ScriptKiddieContent({ phrase }) {
  // Hex dump background scrolls behind a faux progress bar. The
  // percentage is stuck at 47 — the joke is that it never finishes,
  // matching the screen's auto-dismiss behavior.
  const hexLines = Array.from({ length: 20 }, (_, i) => {
    const offset = (i * 16).toString(16).padStart(8, '0').toUpperCase();
    const bytes = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(' ');
    return `${offset}  ${bytes}`;
  });
  return (
    <div className={styles.sprklScreensaverKiddieStage}>
      <pre className={styles.sprklScreensaverKiddieHex} aria-hidden="true">
        {hexLines.join('\n')}
      </pre>
      <div className={styles.sprklScreensaverKiddiePanel}>
        <div className={styles.sprklScreensaverKiddieLabel}>{phrase}</div>
        <div className={styles.sprklScreensaverKiddieBar}>
          <div className={styles.sprklScreensaverKiddieBarFill} />
        </div>
        <div className={styles.sprklScreensaverKiddiePct}>47%</div>
      </div>
    </div>
  );
}

function GrinderContent({ phrase }) {
  return (
    <div className={styles.sprklScreensaverGrinderStage}>
      <div className={styles.sprklScreensaverGrinderText}>{phrase}</div>
    </div>
  );
}

const CONTENT_BY_ARCHETYPE = {
  DEGEN:         DegenContent,
  INFLUENCER:    InfluencerContent,
  '10X_DEV':     DevContent,
  FED:           FedContent,
  SCRIPT_KIDDIE: ScriptKiddieContent,
  GRINDER:       GrinderContent,
};

export default function SprklScreensaver({ sprkl, onDismiss, onMount }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const hasFiredRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const isDismissingRef = useRef(false);

  const archetype = sprkl?.archetype || 'DEGEN';
  const meta = sprkl?.visual_metadata || {};
  const duration = meta.duration_ms ?? DEFAULT_DURATION_MS;
  const phrase = meta.phrase || DEFAULT_PHRASE_BY_ARCHETYPE[archetype] || 'NX';

  const variantClass =
    VARIANT_CLASS_BY_ARCHETYPE[archetype] ||
    VARIANT_CLASS_BY_ARCHETYPE.DEGEN;
  const ContentComponent =
    CONTENT_BY_ARCHETYPE[archetype] || DegenContent;

  // Effect 1: companion-toast onMount with StrictMode gate.
  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (typeof onMount === 'function') onMount(sprkl);
  }, [sprkl, onMount]);

  // Effect 2: dismiss timer + global listeners (mousemove, click,
  // Escape). Single transactional cleanup so a re-render can't leak
  // listeners. Dismiss path is gated by isDismissingRef so the
  // mousemove + click + auto-dismiss can't all fire onDismiss
  // multiple times during the fade-out window.
  useEffect(() => {
    const triggerDismiss = () => {
      if (isDismissingRef.current) return;
      isDismissingRef.current = true;
      setIsFadingOut(true);
      // Wait for the fade-out animation before notifying the
      // parent — the parent unmounts us synchronously on dismiss,
      // so without this delay there's no fade.
      setTimeout(() => onDismiss(), FADE_OUT_MS);
    };

    const handleMouseMove = () => {
      if (Date.now() - mountedAtRef.current < MOUSE_GRACE_MS) return;
      triggerDismiss();
    };

    const handleClick = () => triggerDismiss();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        triggerDismiss();
      }
    };

    const autoDismissTimer = setTimeout(triggerDismiss, duration);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(autoDismissTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [duration, onDismiss]);

  const wrapperClass = isFadingOut
    ? `${styles.sprklScreensaver} ${variantClass} ${styles.sprklScreensaver_fadingOut}`
    : `${styles.sprklScreensaver} ${variantClass}`;

  return (
    <div
      className={wrapperClass}
      role="presentation"
      aria-hidden="true"
    >
      <ContentComponent phrase={phrase} />
      {/* Hint at the dismiss affordance — small, low-contrast, in
          the corner so it doesn't compete with the takeover effect.
          The brief calls for "click anywhere / mousemove / Escape"
          to dismiss; this just makes the affordance discoverable. */}
      <div className={styles.sprklScreensaverHint}>
        move mouse · click · esc
      </div>
    </div>
  );
}
