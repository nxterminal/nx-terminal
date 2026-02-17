// Win98-style pixel art SVG icons (32x32)

export const IconMyPC = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Monitor body */}
    <rect x="4" y="2" width="24" height="18" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="5" y="3" width="22" height="1" fill="#fff" />
    <rect x="4" y="3" width="1" height="16" fill="#fff" />
    {/* Screen */}
    <rect x="7" y="5" width="18" height="12" fill="#000080" />
    <rect x="8" y="6" width="16" height="10" fill="#0000aa" />
    {/* Screen content - small NX */}
    <rect x="12" y="8" width="2" height="6" fill="#fff" />
    <rect x="14" y="10" width="2" height="2" fill="#fff" />
    <rect x="16" y="8" width="2" height="6" fill="#fff" />
    {/* Monitor base */}
    <rect x="11" y="20" width="10" height="2" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="8" y="22" width="16" height="3" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="9" y="22" width="14" height="1" fill="#fff" />
    {/* Power LED */}
    <rect x="15" y="18" width="2" height="1" fill="#33ff33" />
  </svg>
);

export const IconLiveFeed = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Person 1 */}
    <circle cx="11" cy="8" r="4" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="6" y="13" width="10" height="10" rx="1" fill="#000080" stroke="#000" strokeWidth="1" />
    <rect x="7" y="13" width="8" height="1" fill="#0000cc" />
    {/* Person 2 */}
    <circle cx="22" cy="8" r="4" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="17" y="13" width="10" height="10" rx="1" fill="#008080" stroke="#000" strokeWidth="1" />
    <rect x="18" y="13" width="8" height="1" fill="#00aaaa" />
    {/* Connection line */}
    <line x1="13" y1="18" x2="19" y2="18" stroke="#ffd700" strokeWidth="2" />
    {/* Signal waves */}
    <path d="M14 26 Q16 24 18 26" fill="none" stroke="#33ff33" strokeWidth="1" />
    <path d="M12 28 Q16 25 20 28" fill="none" stroke="#33ff33" strokeWidth="1" />
  </svg>
);

export const IconGlobe = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Globe circle */}
    <circle cx="16" cy="16" r="12" fill="#4488ff" stroke="#000" strokeWidth="1" />
    <circle cx="16" cy="16" r="11" fill="#2266cc" />
    {/* Continents - simplified pixel shapes */}
    <rect x="10" y="8" width="6" height="4" fill="#33aa33" />
    <rect x="12" y="12" width="4" height="3" fill="#33aa33" />
    <rect x="18" y="10" width="5" height="6" fill="#33aa33" />
    <rect x="20" y="16" width="4" height="4" fill="#33aa33" />
    <rect x="8" y="18" width="4" height="3" fill="#33aa33" />
    {/* Grid lines */}
    <ellipse cx="16" cy="16" rx="6" ry="12" fill="none" stroke="#5599ee" strokeWidth="0.5" />
    <line x1="4" y1="16" x2="28" y2="16" stroke="#5599ee" strokeWidth="0.5" />
    <line x1="4" y1="10" x2="28" y2="10" stroke="#5599ee" strokeWidth="0.3" opacity="0.5" />
    <line x1="4" y1="22" x2="28" y2="22" stroke="#5599ee" strokeWidth="0.3" opacity="0.5" />
  </svg>
);

export const IconTrophy = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Cup body */}
    <path d="M9 4 L23 4 L21 18 L11 18 Z" fill="#ffd700" stroke="#000" strokeWidth="1" />
    <rect x="10" y="4" width="12" height="2" fill="#ffee55" />
    {/* Cup handles */}
    <path d="M9 6 C4 6 3 12 7 14" fill="none" stroke="#000" strokeWidth="1.5" />
    <path d="M9 7 C5 7 4 12 7 13" fill="none" stroke="#ffd700" strokeWidth="1" />
    <path d="M23 6 C28 6 29 12 25 14" fill="none" stroke="#000" strokeWidth="1.5" />
    <path d="M23 7 C27 7 28 12 25 13" fill="none" stroke="#ffd700" strokeWidth="1" />
    {/* Stem */}
    <rect x="14" y="18" width="4" height="4" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    {/* Base */}
    <rect x="10" y="22" width="12" height="3" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="11" y="22" width="10" height="1" fill="#e0e0e0" />
    {/* Star on cup */}
    <polygon points="16,7 17,10 20,10 18,12 19,15 16,13 13,15 14,12 12,10 15,10" fill="#fff" opacity="0.6" />
  </svg>
);

export const IconChart = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Background */}
    <rect x="3" y="2" width="26" height="24" fill="#fff" stroke="#000" strokeWidth="1" />
    <rect x="4" y="3" width="24" height="1" fill="#c0c0c0" />
    {/* Grid */}
    <line x1="8" y1="5" x2="8" y2="23" stroke="#c0c0c0" strokeWidth="0.5" />
    <line x1="14" y1="5" x2="14" y2="23" stroke="#c0c0c0" strokeWidth="0.5" />
    <line x1="20" y1="5" x2="20" y2="23" stroke="#c0c0c0" strokeWidth="0.5" />
    {/* Bars */}
    <rect x="6" y="14" width="4" height="9" fill="#ff4444" />
    <rect x="12" y="10" width="4" height="13" fill="#33ff33" />
    <rect x="18" y="7" width="4" height="16" fill="#4488ff" />
    <rect x="24" y="12" width="4" height="11" fill="#ffd700" />
    {/* Line chart overlay */}
    <polyline points="8,13 14,9 20,6 26,11" fill="none" stroke="#ff44ff" strokeWidth="1.5" />
    {/* Axis */}
    <line x1="5" y1="23" x2="28" y2="23" stroke="#000" strokeWidth="1" />
    <line x1="5" y1="5" x2="5" y2="23" stroke="#000" strokeWidth="1" />
  </svg>
);

export const IconLab = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Flask body */}
    <path d="M12 2 L12 12 L5 26 L27 26 L20 12 L20 2 Z" fill="#e0e8ff" stroke="#000" strokeWidth="1" />
    <rect x="12" y="2" width="8" height="2" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    {/* Flask highlight */}
    <path d="M13 4 L13 12 L7 24" fill="none" stroke="#fff" strokeWidth="1" opacity="0.6" />
    {/* Liquid */}
    <path d="M8 20 L24 20 L27 26 L5 26 Z" fill="#33ff33" opacity="0.7" />
    <path d="M10 22 L22 22 L25 26 L7 26 Z" fill="#00cc00" opacity="0.5" />
    {/* Bubbles */}
    <circle cx="12" cy="22" r="1.5" fill="#66ff66" opacity="0.8" />
    <circle cx="18" cy="24" r="1" fill="#66ff66" opacity="0.6" />
    <circle cx="15" cy="19" r="1" fill="#66ff66" opacity="0.5" />
    {/* Brain symbol on flask */}
    <path d="M14 8 Q16 6 18 8 Q16 10 14 8" fill="none" stroke="#808080" strokeWidth="0.8" />
  </svg>
);

export const IconFolder = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Folder tab */}
    <path d="M3 8 L3 6 L12 6 L14 8" fill="#ffd700" stroke="#000" strokeWidth="1" />
    <rect x="4" y="6" width="8" height="1" fill="#ffee55" />
    {/* Folder body */}
    <rect x="3" y="8" width="26" height="18" fill="#ffd700" stroke="#000" strokeWidth="1" />
    <rect x="4" y="9" width="24" height="1" fill="#ffee55" />
    <rect x="4" y="9" width="1" height="16" fill="#ffee55" />
    {/* Folder shadow */}
    <rect x="28" y="9" width="1" height="17" fill="#cc9900" />
    <rect x="4" y="25" width="25" height="1" fill="#cc9900" />
  </svg>
);

export const IconMail = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Envelope body */}
    <rect x="3" y="7" width="26" height="18" fill="#fff" stroke="#000" strokeWidth="1" />
    <rect x="4" y="8" width="24" height="1" fill="#e0e0e0" />
    {/* Envelope flap */}
    <path d="M3 7 L16 17 L29 7" fill="none" stroke="#000" strokeWidth="1" />
    <path d="M4 8 L16 16 L28 8" fill="none" stroke="#808080" strokeWidth="0.5" />
    {/* Bottom flap lines */}
    <line x1="3" y1="25" x2="12" y2="17" stroke="#c0c0c0" strokeWidth="0.5" />
    <line x1="29" y1="25" x2="20" y2="17" stroke="#c0c0c0" strokeWidth="0.5" />
    {/* Mail indicator */}
    <rect x="22" y="3" width="8" height="6" rx="1" fill="#ff4444" stroke="#000" strokeWidth="0.5" />
    <text x="26" y="8" textAnchor="middle" fill="#fff" fontSize="5" fontFamily="Tahoma" fontWeight="bold">1</text>
  </svg>
);

export const IconBriefcase = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Handle */}
    <path d="M12 6 L12 10 M20 6 L20 10" stroke="#000" strokeWidth="1.5" />
    <rect x="12" y="4" width="8" height="3" fill="none" stroke="#000" strokeWidth="1" rx="1" />
    {/* Case body */}
    <rect x="3" y="10" width="26" height="16" fill="#8B4513" stroke="#000" strokeWidth="1" rx="1" />
    <rect x="4" y="11" width="24" height="2" fill="#A0522D" />
    <rect x="4" y="11" width="1" height="14" fill="#A0522D" />
    {/* Latch */}
    <rect x="14" y="16" width="4" height="3" fill="#ffd700" stroke="#000" strokeWidth="0.5" />
    <rect x="15" y="17" width="2" height="1" fill="#ffee55" />
    {/* Bottom shadow */}
    <rect x="28" y="11" width="1" height="15" fill="#5a2d0c" />
    <rect x="4" y="25" width="25" height="1" fill="#5a2d0c" />
  </svg>
);

export const IconSettings = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Panel background */}
    <rect x="2" y="2" width="28" height="28" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    <rect x="3" y="3" width="26" height="1" fill="#fff" />
    <rect x="3" y="3" width="1" height="26" fill="#fff" />
    {/* Sliders */}
    <rect x="6" y="8" width="16" height="2" fill="#808080" />
    <rect x="14" y="6" width="4" height="6" fill="#000080" stroke="#000" strokeWidth="0.5" />
    <rect x="6" y="16" width="16" height="2" fill="#808080" />
    <rect x="10" y="14" width="4" height="6" fill="#008000" stroke="#000" strokeWidth="0.5" />
    <rect x="6" y="24" width="16" height="2" fill="#808080" />
    <rect x="18" y="22" width="4" height="6" fill="#ff0000" stroke="#000" strokeWidth="0.5" />
    {/* Color swatches */}
    <rect x="24" y="7" width="4" height="4" fill="#ff0000" stroke="#000" strokeWidth="0.5" />
    <rect x="24" y="15" width="4" height="4" fill="#00ff00" stroke="#000" strokeWidth="0.5" />
    <rect x="24" y="23" width="4" height="4" fill="#0000ff" stroke="#000" strokeWidth="0.5" />
  </svg>
);

export const IconBug = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Body */}
    <ellipse cx="16" cy="18" rx="8" ry="10" fill="#33aa33" stroke="#000" strokeWidth="1" />
    {/* Head */}
    <circle cx="16" cy="7" r="5" fill="#33aa33" stroke="#000" strokeWidth="1" />
    {/* Eyes */}
    <circle cx="14" cy="6" r="2" fill="#fff" stroke="#000" strokeWidth="0.5" />
    <circle cx="18" cy="6" r="2" fill="#fff" stroke="#000" strokeWidth="0.5" />
    <circle cx="14" cy="6" r="1" fill="#000" />
    <circle cx="18" cy="6" r="1" fill="#000" />
    {/* Antennae */}
    <line x1="14" y1="3" x2="10" y2="0" stroke="#000" strokeWidth="1" />
    <line x1="18" y1="3" x2="22" y2="0" stroke="#000" strokeWidth="1" />
    <circle cx="10" cy="0" r="1" fill="#ff4444" />
    <circle cx="22" cy="0" r="1" fill="#ff4444" />
    {/* Legs */}
    <line x1="8" y1="14" x2="3" y2="11" stroke="#000" strokeWidth="1.5" />
    <line x1="8" y1="18" x2="3" y2="18" stroke="#000" strokeWidth="1.5" />
    <line x1="8" y1="22" x2="3" y2="25" stroke="#000" strokeWidth="1.5" />
    <line x1="24" y1="14" x2="29" y2="11" stroke="#000" strokeWidth="1.5" />
    <line x1="24" y1="18" x2="29" y2="18" stroke="#000" strokeWidth="1.5" />
    <line x1="24" y1="22" x2="29" y2="25" stroke="#000" strokeWidth="1.5" />
    {/* Shell line */}
    <line x1="16" y1="10" x2="16" y2="27" stroke="#228822" strokeWidth="1" />
  </svg>
);

export const IconCards = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
    {/* Back card */}
    <rect x="6" y="2" width="18" height="24" rx="2" fill="#000080" stroke="#000" strokeWidth="1" />
    <rect x="8" y="4" width="14" height="20" fill="#0000aa" stroke="#ffd700" strokeWidth="0.5" />
    {/* NX on back card */}
    <text x="15" y="16" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="monospace" fontWeight="bold">NX</text>
    {/* Front card offset */}
    <rect x="10" y="6" width="18" height="24" rx="2" fill="#fff" stroke="#000" strokeWidth="1" />
    {/* Card content - Ace of spades */}
    <text x="13" y="13" fill="#000" fontSize="7" fontFamily="serif" fontWeight="bold">A</text>
    <text x="13" y="19" fill="#000" fontSize="6" fontFamily="serif">{'\u2660'}</text>
    <text x="25" y="28" fill="#000" fontSize="7" fontFamily="serif" fontWeight="bold" textAnchor="end"
      transform="rotate(180,24,25)">A</text>
  </svg>
);

// Icon mapping by ID
const ICON_MAP = {
  'nx-terminal': IconMyPC,
  'live-feed': IconLiveFeed,
  'world-chat': IconGlobe,
  'leaderboard': IconTrophy,
  'protocol-market': IconChart,
  'ai-lab': IconLab,
  'my-devs': IconFolder,
  'inbox': IconMail,
  'hire-devs': IconBriefcase,
  'control-panel': IconSettings,
  'bug-sweeper': IconBug,
  'protocol-solitaire': IconCards,
};

export function Win98Icon({ id, size = 32 }) {
  const IconComponent = ICON_MAP[id];
  if (!IconComponent) return <span style={{ fontSize: size + 'px' }}>?</span>;
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconComponent />
    </div>
  );
}

export default ICON_MAP;
