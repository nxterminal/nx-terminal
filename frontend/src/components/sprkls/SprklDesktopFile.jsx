/**
 * SprklDesktopFile — fake "file dropped on your desktop" sprkl.
 *
 * Renders a small Win98 file icon (text-document silhouette + corner
 * fold) at the backend-provided x_pct/y_pct position. Click opens a
 * preview modal showing the flavor text. NO auto-dismiss; the file
 * persists on the desktop until the user explicitly removes it via
 * the X button on the icon or the Delete entry in the preview.
 *
 * Position: %-of-layer (the parent .sprklsDesktopFileLayer is
 * fullscreen-fixed and respects --sprkls-safe-bottom-px so files
 * never render under the taskbar).
 *
 * StrictMode double-invoke gate: hasFiredRef ensures the companion
 * toast fires once even when the effect runs twice in dev.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './sprkls.module.css';

export default function SprklDesktopFile({ sprkl, onDismiss, onMount }) {
  const [showPreview, setShowPreview] = useState(false);
  const hasFiredRef = useRef(false);

  const meta = sprkl?.visual_metadata ?? {};
  const filename = meta.filename || 'untitled.txt';
  const preview =
    meta.preview ||
    '(empty file — the sprkl was lazy)';
  const xPct = meta.position?.x_pct ?? 50;
  const yPct = meta.position?.y_pct ?? 50;

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (typeof onMount === 'function') onMount(sprkl);
  }, [sprkl, onMount]);

  const handleIconClick = (e) => {
    e.stopPropagation();
    setShowPreview(true);
  };

  const handleClosePreview = (e) => {
    e?.stopPropagation?.();
    setShowPreview(false);
  };

  const handleDelete = (e) => {
    e?.stopPropagation?.();
    onDismiss();
  };

  // Icon keyboard a11y: Enter / Space opens preview, Escape /
  // Delete dismisses the file. Tab order naturally hits each
  // desktop-file icon once because they're focusable buttons.
  const handleIconKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowPreview(true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDismiss();
    }
  };

  return (
    <>
      <div
        className={styles.sprklDesktopFile}
        style={{ left: `${xPct}%`, top: `${yPct}%` }}
      >
        <button
          type="button"
          className={styles.sprklDesktopFileIcon}
          onClick={handleIconClick}
          onKeyDown={handleIconKeyDown}
          aria-label={`Open file ${filename}`}
          title={filename}
        >
          {/* Win98-style document SVG: rectangle + corner fold +
              three "text lines" hint. Drawn inline so it stays
              decoupled from any central icon component (those
              components are about real desktop programs). */}
          <svg
            width="32"
            height="40"
            viewBox="0 0 32 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className={styles.sprklDesktopFileSvg}
          >
            {/* Page body */}
            <path
              d="M4 2 L22 2 L28 8 L28 38 L4 38 Z"
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1"
              strokeLinejoin="miter"
            />
            {/* Corner fold (small triangle) */}
            <path
              d="M22 2 L22 8 L28 8 Z"
              fill="#d8d8d8"
              stroke="#000000"
              strokeWidth="1"
              strokeLinejoin="miter"
            />
            {/* Text lines */}
            <line x1="8"  y1="14" x2="24" y2="14" stroke="#888" strokeWidth="1" />
            <line x1="8"  y1="18" x2="24" y2="18" stroke="#888" strokeWidth="1" />
            <line x1="8"  y1="22" x2="20" y2="22" stroke="#888" strokeWidth="1" />
            <line x1="8"  y1="26" x2="24" y2="26" stroke="#888" strokeWidth="1" />
            <line x1="8"  y1="30" x2="18" y2="30" stroke="#888" strokeWidth="1" />
          </svg>
          <span className={styles.sprklDesktopFileLabel}>{filename}</span>
        </button>
        {/* Tiny X badge to dismiss without opening the preview. The
            file is meant to feel persistent ("a Dev dropped this
            here") so we DON'T expose this as the primary action —
            click on the icon itself opens the preview, the X is the
            secondary "make it go away" affordance. */}
        <button
          type="button"
          className={styles.sprklDesktopFileDismiss}
          onClick={handleDelete}
          aria-label={`Delete ${filename}`}
          title="Delete"
        >
          ✕
        </button>
      </div>

      {showPreview && (
        <div
          className={styles.sprklDesktopFilePreviewBackdrop}
          onClick={handleClosePreview}
        >
          <div
            className={styles.sprklDesktopFilePreview}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`sprkl-file-preview-title-${sprkl.id}`}
          >
            <div className={styles.sprklDesktopFilePreviewTitleBar}>
              <span
                id={`sprkl-file-preview-title-${sprkl.id}`}
                className={styles.sprklDesktopFilePreviewTitle}
              >
                {filename}
              </span>
              <button
                type="button"
                className={styles.sprklDesktopFilePreviewClose}
                onClick={handleClosePreview}
                aria-label="Close preview"
                title="Close"
              >
                ✕
              </button>
            </div>
            <pre className={styles.sprklDesktopFilePreviewBody}>{preview}</pre>
            <div className={styles.sprklDesktopFilePreviewButtons}>
              <button
                type="button"
                className={styles.sprklDesktopFilePreviewButton}
                onClick={handleClosePreview}
                autoFocus
              >
                Close
              </button>
              <button
                type="button"
                className={styles.sprklDesktopFilePreviewButton}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
