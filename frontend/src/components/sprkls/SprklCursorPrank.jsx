/**
 * SprklCursorPrank — visually wiggle the user's cursor for ~2s.
 *
 * Browsers don't let JS move the real cursor (security). What we
 * CAN do:
 *   1. Hide the real cursor by setting `body { cursor: none }` for
 *      the duration of the prank.
 *   2. Render a fake cursor SVG following mousemove with a small
 *      randomised offset.
 *   3. Restore the real cursor on cleanup.
 *
 * Why `body.style.cursor = 'none'` and not the brief's CSS-class
 * approach: `cursor: none` on a `pointer-events: none` overlay has
 * no effect — disabling pointer events also disables the cursor
 * style. We need the real cursor hidden globally, so the body-style
 * approach is the workable one. Documented inline so a future
 * refactor doesn't try to move it back to the overlay.
 *
 * Click pass-through: the fake-cursor element has
 * pointer-events: none so clicks reach the underlying desktop /
 * windows / chat modal as normal. The wiggle is purely visual
 * gaslighting; functionally everything still works.
 *
 * Queue semantics: SprklsLayer renders ONE cursor_prank at a time
 * (overlapping wiggles would visually cancel each other and also
 * stack body-cursor-overrides, which would survive past the first
 * dismiss). Subsequent pranks queue and mount when the previous
 * dismisses.
 *
 * StrictMode gate: hasFiredRef ensures the companion-toast onMount
 * fires once even when the effect runs twice in dev.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './sprkls.module.css';

const DEFAULT_DURATION_MS = 2_000;
const WIGGLE_INTERVAL_MS = 50;
// The brief specced "1-5px" max wiggle. wiggle_intensity from
// visual_metadata is 0..1; multiply by MAX_WIGGLE_PX to scale.
const MAX_WIGGLE_PX = 5;

export default function SprklCursorPrank({ sprkl, onDismiss, onMount }) {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [wiggle, setWiggle] = useState({ x: 0, y: 0 });
  const hasFiredRef = useRef(false);

  const meta = sprkl?.visual_metadata ?? {};
  const duration = meta.duration_ms ?? DEFAULT_DURATION_MS;
  // Clamp intensity to a sane range so a malformed backend value
  // can't produce a 200px wiggle.
  const rawIntensity = typeof meta.wiggle_intensity === 'number'
    ? meta.wiggle_intensity
    : 0.7;
  const intensity = Math.max(0, Math.min(1, rawIntensity));
  const maxWiggle = MAX_WIGGLE_PX * intensity;

  // Effect 1: companion-toast notification on mount + StrictMode gate.
  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (typeof onMount === 'function') onMount(sprkl);
  }, [sprkl, onMount]);

  // Effect 2: hide real cursor + track mouse + wiggle + dismiss.
  // Single useEffect so cleanup runs as one transaction (real
  // cursor restored, listener removed, intervals/timeouts cleared).
  useEffect(() => {
    // Capture the prior cursor value so the cleanup restores
    // whatever was there before — usually empty string, but if a
    // future feature pre-set body.style.cursor we don't want to
    // overwrite that to ''. typeof check guards against SSR.
    const priorBodyCursor =
      typeof document !== 'undefined'
        ? document.body.style.cursor
        : '';
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'none';
    }

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const wiggleInterval = setInterval(() => {
      setWiggle({
        x: (Math.random() - 0.5) * 2 * maxWiggle,
        y: (Math.random() - 0.5) * 2 * maxWiggle,
      });
    }, WIGGLE_INTERVAL_MS);

    const dismissTimer = setTimeout(() => onDismiss(), duration);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(wiggleInterval);
      clearTimeout(dismissTimer);
      if (typeof document !== 'undefined') {
        document.body.style.cursor = priorBodyCursor;
      }
    };
  }, [duration, maxWiggle, onDismiss]);

  return (
    <div
      className={styles.sprklCursorPrankFakeCursor}
      style={{
        left: mousePos.x + wiggle.x,
        top: mousePos.y + wiggle.y,
      }}
      aria-hidden="true"
    >
      {/* Win98-style pointer SVG. Black fill + thin white stroke so
          the cursor reads against any background. The triangle path
          mirrors the classic pointer shape (top-left tip, lower-
          right tail). */}
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M0 0 L0 12 L4 8 L8 16 L11 14 L7 6 L12 6 Z"
          fill="#000"
          stroke="#fff"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}
