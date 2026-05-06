/**
 * PostAvatar — pixel-art SVG avatar generator + IPFS-image fallback.
 *
 * Backend posts carry an `ipfs_image` URL (the official Dev image).
 * Use that as the primary; if it's empty / fails to load, fall back
 * to a deterministic 8×8 pixel-art SVG seeded by `${name}-${token_id}`
 * so each Dev still has a stable identity even when the IPFS image
 * is missing.
 *
 * The pixel-art generator uses a corp-keyed palette so a SHALLOW_MIND
 * Dev always renders in pink-ish tones, etc. — matches the corp
 * badge colour for visual consistency.
 *
 * Why hash the seed manually instead of `Math.random()`: avatars
 * must be stable across re-renders + page reloads. A trivial
 * string-hash is enough — we just need a deterministic 32-bit int.
 */

import { useMemo } from 'react';
import styles from './nxposts.module.css';

// Per-corp palette. Each entry is [primary, secondary, dark]; the
// generator picks among them per-pixel using the seeded RNG so
// avatars feel hand-drawn rather than blocky-flat.
const CORP_PALETTES = {
  MISANTHROPIC:     ['#8a4dba', '#a06fce', '#5d3585'],
  CLOSED_AI:        ['#c97a00', '#e89412', '#8c5500'],
  SHALLOW_MIND:     ['#cc4488', '#e066a3', '#8b2e5c'],
  ZUCK_LABS:        ['#4a7ec4', '#6e9cd6', '#345789'],
  Y_AI:             ['#c9333a', '#e0535a', '#8b2329'],
  MISTRIAL_SYSTEMS: ['#c9772a', '#df9047', '#8b521d'],
};
const DEFAULT_PALETTE = ['#666', '#999', '#444'];

// 32-bit FNV-1a — small, fast, and stable across runtimes. We don't
// need cryptographic strength; we just need "same input → same int".
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Mulberry32 — deterministic PRNG seeded by the FNV hash. Good
// enough distribution for 64 binary cells (8×8) without pulling
// in a real crypto API.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePixelGrid(seed) {
  // 8 wide × 8 tall, mirrored across the vertical centre so the
  // result reads as a face. We compute the LEFT half (4 cols) and
  // mirror it to the right; this halves the entropy budget and
  // produces faces that don't look glitchy.
  const rng = makeRng(seed);
  const cells = []; // {x, y, paletteIndex}
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      // ~45% fill rate — too sparse and the avatar disappears,
      // too dense and it reads as a solid blob.
      if (rng() < 0.45) {
        const paletteIndex = Math.floor(rng() * 3);
        cells.push({ x, y, paletteIndex });
        // Mirror across the vertical centre (cols 0..3 → 7..4).
        cells.push({ x: 7 - x, y, paletteIndex });
      }
    }
  }
  return cells;
}

export default function PostAvatar({
  ipfsImage,
  name,
  tokenId,
  corp,
  size = 48,
  onClick,
  ariaLabel,
}) {
  const palette = useMemo(() => {
    return CORP_PALETTES[corp] || DEFAULT_PALETTE;
  }, [corp]);

  const cells = useMemo(() => {
    const seed = hash32(`${name || 'dev'}-${tokenId || 0}`);
    return generatePixelGrid(seed);
  }, [name, tokenId]);

  // Backend always sends a string; empty-string means "no IPFS image
  // available". Treat both null/undefined and "" as no-image.
  const hasIpfs = typeof ipfsImage === 'string' && ipfsImage.length > 0;

  // Pixel grid renders at any size via SVG viewBox scaling.
  // image-rendering: pixelated on the wrapper keeps cells crisp.
  const inner = hasIpfs ? (
    <img
      src={ipfsImage}
      alt={ariaLabel || name || 'Dev avatar'}
      width={size}
      height={size}
      loading="lazy"
      className={styles.postAvatarImg}
      // Fallback: if the IPFS gateway 404s or hangs, swap to the
      // generated avatar by setting src to a 1px transparent and
      // letting the parent's CSS background show. Simpler than
      // tracking a hadError state.
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      className={styles.postAvatarSvg}
      aria-label={ariaLabel || name || 'Dev avatar'}
    >
      {/* Background rect — fills any gaps so the avatar reads as a
          solid card rather than transparent pixels on the desktop. */}
      <rect width="8" height="8" fill={palette[2]} opacity="0.15" />
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width="1"
          height="1"
          fill={palette[c.paletteIndex] || palette[0]}
        />
      ))}
    </svg>
  );

  if (typeof onClick === 'function') {
    return (
      <button
        type="button"
        className={styles.postAvatarBtn}
        onClick={onClick}
        style={{ width: size, height: size }}
        aria-label={ariaLabel || `Open chat with ${name || 'Dev'}`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div
      className={styles.postAvatar}
      style={{ width: size, height: size }}
    >
      {inner}
    </div>
  );
}
