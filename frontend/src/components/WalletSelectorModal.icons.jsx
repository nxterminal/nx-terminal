// Inline SVG brand marks used by the wallet selector modal. Kept in a
// separate file so the modal component itself stays focused on layout and
// behavior rather than path data. Both icons are decorative — they render
// with aria-hidden from the consumer.

// Simplified MetaMask fox. Uses the recognizable orange/amber silhouette
// and two eye dots. Not pixel-for-pixel official — that mark is trademarked
// and shipped via @metamask/* packages we don't depend on — but close
// enough that users recognize it at card size.
export function MetaMaskIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ears */}
      <path d="M6 6 L14 14 L11 19 Z" fill="#e17726" />
      <path d="M34 6 L26 14 L29 19 Z" fill="#e27625" />
      {/* Head */}
      <path d="M8 18 L14 14 L20 17 L26 14 L32 18 L30 28 L26 30 L22 28 L18 28 L14 30 L10 28 Z" fill="#f6851b" />
      {/* Snout */}
      <path d="M14 30 L18 28 L22 28 L26 30 L24 34 L20 35 L16 34 Z" fill="#c0ad9e" />
      {/* Eyes */}
      <circle cx="15" cy="22" r="1.8" fill="#233447" />
      <circle cx="25" cy="22" r="1.8" fill="#233447" />
      {/* Eye highlights */}
      <circle cx="15.5" cy="21.5" r="0.5" fill="#ffffff" />
      <circle cx="25.5" cy="21.5" r="0.5" fill="#ffffff" />
    </svg>
  );
}

// MegaETH Wallet mark — the circular "M" logo as used on the MOSS connect
// sheet. Indigo fill, white glyph, two dots underneath referencing the
// two-tone brand accent. Simplified geometry from the original asset.
export function MegaIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="18" fill="#6366f1" />
      {/* Stylized M: two verticals + a central V */}
      <path
        d="M11 14 L11 26 M29 14 L29 26 M11 14 L20 22 L29 14"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Two accent dots */}
      <circle cx="16.5" cy="29.5" r="1.1" fill="#ffffff" />
      <circle cx="23.5" cy="29.5" r="1.1" fill="#ffffff" />
    </svg>
  );
}
