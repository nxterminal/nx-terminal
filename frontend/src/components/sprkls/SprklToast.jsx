/**
 * SprklToast — one floating Win98-style notification.
 *
 * Lifecycle:
 *   - On mount, schedule auto-dismiss for `visual_metadata.duration_ms`
 *     (default 8000 ms). The timer fires `onDismiss()` from the
 *     parent <SprklsLayer>, which in turn calls the hook's
 *     dismiss(postId) — that POSTs to the backend AND optimistically
 *     drops the row from local state.
 *   - Hover pauses the timer and remembers the REMAINING time, not
 *     the original duration. Mouse-leave resumes from where it left
 *     off so a quick hover doesn't reset a toast that was already
 *     7s into its 8s life.
 *   - Click anywhere except the X button → onClick (opens the chat
 *     modal directly into this Dev's conversation, courtesy of
 *     Phase 3.6's openChatModal(devId) entry point).
 *   - Click on X → stopPropagation + onDismiss. preventDefault on
 *     the outer click handler isn't needed because the toast isn't
 *     inside a form / link.
 *
 * Avatar: PFP zoom (transform: scale(1.5)) inside an
 * overflow:hidden frame. Lighter zoom than the chat-list 2.2× — the
 * toast frame is small and a heavy zoom makes the face ambiguous.
 *
 * Sounds: deliberately silent in Phase 4.2. The brief said "can be
 * silent for v1 if audio adds complexity"; reusing the chat ding
 * here would compete with Dev replies in the modal. A dedicated
 * sprkl-arrival sfx can land in Phase 4.5.
 */

import { useCallback, useEffect, useRef } from 'react';
import styles from './sprkls.module.css';

const DEFAULT_DURATION_MS = 8000;

export default function SprklToast({ sprkl, onDismiss, onClick }) {
  // Refs survive re-renders without retriggering the mount effect;
  // useState would force a fresh schedule on each pause/resume.
  const dismissTimerRef = useRef(null);
  const remainingMsRef = useRef(null);
  const startedAtRef = useRef(null);

  const duration =
    sprkl.visual_metadata?.duration_ms ?? DEFAULT_DURATION_MS;

  const startTimer = useCallback(
    (ms) => {
      // Clear any previous timer before scheduling a new one — guards
      // against a race where pause+resume run in the same React
      // microtask and would otherwise leak a timer.
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      startedAtRef.current = Date.now();
      remainingMsRef.current = ms;
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        onDismiss();
      }, ms);
    },
    [onDismiss]
  );

  const pauseTimer = useCallback(() => {
    if (!dismissTimerRef.current) return;
    clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
    const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
    remainingMsRef.current = Math.max(
      0,
      (remainingMsRef.current ?? 0) - elapsed
    );
  }, []);

  const resumeTimer = useCallback(() => {
    if (dismissTimerRef.current) return; // already running
    if ((remainingMsRef.current ?? 0) <= 0) {
      // Time already up but the timeout never fired (e.g. paused at
      // 0ms, mouse left). Dismiss immediately rather than scheduling
      // a 0ms setTimeout that races with pointer events.
      onDismiss();
      return;
    }
    startTimer(remainingMsRef.current);
  }, [onDismiss, startTimer]);

  // Mount-only schedule. The dependency on `duration` is correct for
  // a fresh mount; if the parent ever passes a sprkl whose duration
  // changed mid-life it'd reset the countdown — fine for the use case
  // (each sprkl is rendered with a stable key, so a duration change
  // implies a different sprkl).
  useEffect(() => {
    startTimer(duration);
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseClick = (e) => {
    // The toast itself is clickable to open the chat — the X button
    // must not bubble or the dismiss + open would race.
    e.stopPropagation();
    onDismiss();
  };

  const handleToastClick = () => {
    onClick();
  };

  return (
    <div
      className={styles.sprklToast}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={resumeTimer}
      onClick={handleToastClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Keyboard a11y: Enter / Space opens the chat, Escape dismisses.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onDismiss();
        }
      }}
      aria-label={`Sprkl from ${sprkl.name ?? 'a Dev'} — click to open chat`}
    >
      <div className={styles.sprklTitleBar}>
        <span className={styles.sprklTitleText}>
          💬 {sprkl.name ?? 'Sprkl'}
        </span>
        <button
          type="button"
          className={styles.sprklCloseBtn}
          onClick={handleCloseClick}
          aria-label="Dismiss sprkl"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
      <div className={styles.sprklBody}>
        <div className={styles.sprklAvatarWrap}>
          {sprkl.ipfs_image ? (
            <img
              src={sprkl.ipfs_image}
              alt=""
              loading="lazy"
              className={styles.sprklAvatar}
            />
          ) : (
            <div className={styles.sprklAvatarFallback}>
              {sprkl.name?.slice(0, 2).toUpperCase() || '??'}
            </div>
          )}
        </div>
        <div className={styles.sprklContentColumn}>
          <div className={styles.sprklNameRow}>
            <span className={styles.sprklName}>{sprkl.name}</span>
            <span className={styles.sprklArchetype}>
              {sprkl.archetype}
            </span>
          </div>
          <div className={styles.sprklContent}>{sprkl.content}</div>
        </div>
      </div>
    </div>
  );
}
