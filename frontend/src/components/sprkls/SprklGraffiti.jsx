/**
 * SprklGraffiti — one piece of vandal text painted on the desktop.
 *
 * Phase 4.3 surface for sprkls with `action_type='graffiti'`.
 * Backend (services/sprkls/visuals.py) hands us a fully-shaped
 * `visual_metadata`:
 *
 *   {
 *     color:        "#ff4d8f",        per-archetype palette
 *     position:     { x_pct, y_pct }, viewport-percent within bounds
 *                                      that already exclude the
 *                                      taskbar / icon column
 *     rotation_deg: -8..8,            light tilt for hand-painted feel
 *     font_size_px: 24..40,           per-piece variation
 *     font_family:  "Permanent Marker"
 *   }
 *
 * Click anywhere on the text → dismiss (the whole graffiti is one
 * button). Unlike toasts, graffiti has NO auto-dismiss — the user
 * is in charge. The 7-day TTL on the backend row is the only
 * other expiry; once expired or dismissed, /sprkls/recent stops
 * returning it and the next poll drops the element from the layer.
 *
 * Rendering choices:
 *   - HTML <button> with absolute positioning + transform: rotate.
 *     Considered SVG <text> per the brief's wording but a styled
 *     button is simpler, picks up the Google Font automatically,
 *     and gives us free keyboard focus + click semantics. The
 *     "spray paint feel" comes from the font + rotation + drop
 *     shadow, not the markup substrate.
 *   - text-shadow gives a subtle paint-bleed without going full
 *     drop-shadow (which would feel more like a sticker than spray).
 *   - The font_family from visual_metadata is passed through so a
 *     future Phase 4.x can ship a per-archetype font without code
 *     changes here.
 */

import styles from './sprkls.module.css';

const DEFAULT_COLOR = '#22c55e';      // matches services/sprkls/visuals._DEFAULT_PALETTE end
const DEFAULT_FONT_SIZE_PX = 32;
const DEFAULT_ROTATION_DEG = 0;
const DEFAULT_FONT_FAMILY = "'Permanent Marker', cursive";
const DEFAULT_X_PCT = 30;
const DEFAULT_Y_PCT = 30;

export default function SprklGraffiti({ sprkl, onDismiss, onClick }) {
  const meta = sprkl?.visual_metadata || {};
  const color = meta.color || DEFAULT_COLOR;
  const fontSizePx = meta.font_size_px || DEFAULT_FONT_SIZE_PX;
  const rotationDeg = meta.rotation_deg ?? DEFAULT_ROTATION_DEG;
  const xPct = meta.position?.x_pct ?? DEFAULT_X_PCT;
  const yPct = meta.position?.y_pct ?? DEFAULT_Y_PCT;
  // The backend's font_family value matches a CSS font name. Wrap
  // the literal in quotes if needed so multi-word names like
  // "Permanent Marker" resolve correctly.
  const rawFontFamily = meta.font_family;
  const fontFamily = rawFontFamily
    ? `'${rawFontFamily}', cursive`
    : DEFAULT_FONT_FAMILY;

  // Long-press / right-click semantics aren't part of Phase 4.3 —
  // the click handler dismisses, full stop. onClick (open chat) is
  // exposed for parity with SprklToast in case the parent ever wants
  // to wire it; the brief specifies "Click → dismiss" so the
  // default behaviour calls onDismiss and ignores onClick.
  const handleClick = (e) => {
    e.stopPropagation();
    if (typeof onClick === 'function') {
      onClick(e);
      return;
    }
    onDismiss();
  };

  return (
    <button
      type="button"
      className={styles.sprklGraffiti}
      onClick={handleClick}
      onKeyDown={(e) => {
        // Keyboard a11y: Enter / Space / Escape all dismiss.
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          onDismiss();
        }
      }}
      style={{
        // Position is relative to the layer wrapper (which is
        // fixed to the viewport). Translate -50% / -50% would
        // center on the anchor; we use 0/0 so x_pct/y_pct
        // describes the TOP-LEFT of the text. Backend bounds keep
        // x_pct ≤ 80% and y_pct ≤ 75% so even long lines stay
        // inside the visible area.
        left:        `${xPct}%`,
        top:         `${yPct}%`,
        transform:   `rotate(${rotationDeg}deg)`,
        color,
        fontSize:    `${fontSizePx}px`,
        fontFamily,
        // textShadow softens the stroke just enough to feel painted
        // rather than printed; using an alpha of the same hue keeps
        // the bloom visually consistent with the foreground colour.
        textShadow:  `0 1px 0 rgba(0,0,0,0.18), 0 0 8px ${color}33`,
      }}
      aria-label={`Graffiti from ${sprkl?.name ?? 'a Dev'}: ${sprkl?.content ?? ''}. Click to dismiss.`}
      title="Click to dismiss"
    >
      {sprkl.content}
    </button>
  );
}
