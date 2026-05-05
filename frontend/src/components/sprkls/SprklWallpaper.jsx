/**
 * SprklWallpaper — temporarily replace the desktop background.
 *
 * Phase 4.5b surface for sprkls with `action_type='wallpaper'`. Less
 * intrusive than a screensaver: a fullscreen overlay sits at z-index
 * 50 (above the desktop background, below windows / taskbar /
 * sprkls / modal) so the user keeps full interactive control of
 * everything they care about — only the background pixels change.
 *
 * Layer wrapper: pointer-events: none so clicks fall through to the
 * desktop. The "Restore" button anchored top-right uses its own
 * stacking context (z-index 9600) and re-enables pointer events for
 * itself only — gives the user an explicit way out without waiting
 * for the auto-dismiss timer.
 *
 * Fade timings:
 *   - Fade-IN 1.5s: a slow swap so the user has time to register
 *     "huh, my wallpaper changed" before the eye snaps to it.
 *   - Fade-OUT 1s: faster on the way out so dismissing feels
 *     responsive.
 *
 * StrictMode gate: hasFiredRef prevents the onMount companion
 * callback from firing twice under React 19's intentional double-
 * invoke. The dismiss timer is naturally idempotent.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './sprkls.module.css';

const DEFAULT_DURATION_MS = 60_000;
const FADE_OUT_MS = 1_000;

// Archetype → CSS variant class. Per-archetype patterns live in CSS
// (background gradients + repeating SVG data URIs); JSX just picks
// the variant + renders the Restore affordance. Adding a new
// archetype only requires a new CSS class here.
const VARIANT_CLASS_BY_ARCHETYPE = {
  DEGEN:         styles.sprklWallpaper_degen,
  INFLUENCER:    styles.sprklWallpaper_influencer,
  '10X_DEV':     styles.sprklWallpaper_dev,
  FED:           styles.sprklWallpaper_fed,
  SCRIPT_KIDDIE: styles.sprklWallpaper_scriptKiddie,
  GRINDER:       styles.sprklWallpaper_grinder,
};

export default function SprklWallpaper({ sprkl, onDismiss, onMount }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const hasFiredRef = useRef(false);
  const isDismissingRef = useRef(false);

  const archetype = sprkl?.archetype || 'INFLUENCER';
  const meta = sprkl?.visual_metadata || {};
  const duration = meta.duration_ms ?? DEFAULT_DURATION_MS;

  const variantClass =
    VARIANT_CLASS_BY_ARCHETYPE[archetype] ||
    VARIANT_CLASS_BY_ARCHETYPE.INFLUENCER;

  // Effect 1: companion-toast onMount with StrictMode gate.
  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (typeof onMount === 'function') onMount(sprkl);
  }, [sprkl, onMount]);

  // Effect 2: auto-dismiss timer. Wraps onDismiss in the same
  // fade-out trigger as the manual Restore click so both paths feel
  // identical to the user.
  useEffect(() => {
    const triggerDismiss = () => {
      if (isDismissingRef.current) return;
      isDismissingRef.current = true;
      setIsFadingOut(true);
      setTimeout(() => onDismiss(), FADE_OUT_MS);
    };

    const timer = setTimeout(triggerDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const handleRestore = (e) => {
    e?.stopPropagation?.();
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => onDismiss(), FADE_OUT_MS);
  };

  const bgClass = isFadingOut
    ? `${styles.sprklWallpaperBg} ${variantClass} ${styles.sprklWallpaper_fadingOut}`
    : `${styles.sprklWallpaperBg} ${variantClass}`;

  return (
    <>
      <div className={bgClass} aria-hidden="true" />
      <button
        type="button"
        className={styles.sprklWallpaperRestore}
        onClick={handleRestore}
        title="Restore wallpaper"
        aria-label="Restore original wallpaper"
      >
        ↺ Restore
      </button>
    </>
  );
}
