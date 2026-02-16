/* ═══════════════════════════════════════════════════
   Win98 SVG Icon Library — zero emojis
   All icons accept { size } prop (default 16)
   ═══════════════════════════════════════════════════ */

export function IconMonitor({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="10" rx="1" fill="#c0c0c0" stroke="#000" strokeWidth="0.7"/>
      <rect x="3" y="3" width="10" height="6" fill="#0c0c0c" stroke="#808080" strokeWidth="0.5"/>
      <rect x="5" y="4" width="4" height="1" fill="#33ff33"/>
      <rect x="5" y="6" width="6" height="1" fill="#33ff33"/>
      <rect x="6" y="11" width="4" height="1.5" fill="#a0a0a0" stroke="#808080" strokeWidth="0.3"/>
      <rect x="4" y="12.5" width="8" height="1.5" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.3"/>
    </svg>
  );
}

export function IconEnvelope({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" fill="#f0e068" stroke="#000" strokeWidth="0.7"/>
      <path d="M1 3 L8 9 L15 3" stroke="#c0a020" strokeWidth="0.7" fill="none"/>
      <path d="M1 13 L6 8" stroke="#c0a020" strokeWidth="0.5"/>
      <path d="M15 13 L10 8" stroke="#c0a020" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconBriefcase({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="5" width="14" height="9" rx="1" fill="#8B6914" stroke="#000" strokeWidth="0.7"/>
      <rect x="5" y="2" width="6" height="4" fill="none" stroke="#5a4010" strokeWidth="0.7" rx="0.5"/>
      <rect x="1" y="8" width="14" height="1.5" fill="#a07818"/>
      <rect x="6" y="7" width="4" height="3" rx="0.5" fill="#c0a040" stroke="#5a4010" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconFolderPerson({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="5" width="14" height="9" rx="0.5" fill="#ffcc00" stroke="#000" strokeWidth="0.7"/>
      <path d="M1 5 L6 5 L7 3 L1 3 Z" fill="#ffdd44" stroke="#000" strokeWidth="0.5"/>
      <circle cx="8" cy="8.5" r="2" fill="#808080"/>
      <path d="M5 13 Q5 11 8 11 Q11 11 11 13" fill="#808080"/>
    </svg>
  );
}

export function IconChart({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" fill="white" stroke="#808080" strokeWidth="0.7"/>
      <rect x="3" y="9" width="2" height="4" fill="#000080"/>
      <rect x="6" y="6" width="2" height="7" fill="#000080"/>
      <rect x="9" y="3" width="2" height="10" fill="#000080"/>
      <rect x="12" y="7" width="2" height="6" fill="#000080"/>
      <line x1="2" y1="13.5" x2="15" y2="13.5" stroke="#000" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconAntenna({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="7" y="6" width="2" height="8" fill="#808080" stroke="#404040" strokeWidth="0.3"/>
      <rect x="5" y="12" width="6" height="2" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.3"/>
      <circle cx="8" cy="5" r="2" fill="#ff4444"/>
      <path d="M4 3 Q8 0 12 3" stroke="#ff4444" strokeWidth="0.7" fill="none"/>
      <path d="M2 1.5 Q8 -2 14 1.5" stroke="#ff4444" strokeWidth="0.5" fill="none" opacity="0.6"/>
    </svg>
  );
}

export function IconCart({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1 2 L3 2 L5 10 L13 10" stroke="#000" strokeWidth="0.8" fill="none"/>
      <rect x="4" y="4" width="10" height="5" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <line x1="7" y1="4" x2="7" y2="9" stroke="#808080" strokeWidth="0.4"/>
      <line x1="10" y1="4" x2="10" y2="9" stroke="#808080" strokeWidth="0.4"/>
      <circle cx="6" cy="12" r="1.3" fill="#404040"/>
      <circle cx="11" cy="12" r="1.3" fill="#404040"/>
    </svg>
  );
}

export function IconDollar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1" fill="#33aa33" stroke="#006600" strokeWidth="0.7"/>
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="#006600" strokeWidth="0.5"/>
      <text x="8" y="10.5" textAnchor="middle" fill="#004400" fontSize="7" fontWeight="bold" fontFamily="serif">$</text>
    </svg>
  );
}

export function IconChartLens({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="white" stroke="#808080" strokeWidth="0.5"/>
      <polyline points="2,9 4,7 6,8 8,4 10,6" stroke="#ff4444" strokeWidth="0.8" fill="none"/>
      <circle cx="11" cy="11" r="3" fill="none" stroke="#000080" strokeWidth="1"/>
      <line x1="13" y1="13" x2="15" y2="15" stroke="#000080" strokeWidth="1.5"/>
    </svg>
  );
}

export function IconBook({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="11" height="14" rx="1" fill="#0060c0" stroke="#000" strokeWidth="0.7"/>
      <rect x="4" y="1" width="9" height="14" rx="0.5" fill="#0080e0"/>
      <rect x="5" y="3" width="7" height="1" fill="white" opacity="0.6"/>
      <rect x="5" y="5" width="5" height="1" fill="white" opacity="0.4"/>
      <text x="8.5" y="11" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">?</text>
    </svg>
  );
}

export function IconScroll({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" fill="#f5e6c8" stroke="#8B6914" strokeWidth="0.7"/>
      <path d="M3 2 Q2 2 2 3 L2 4 L4 4 L4 2" fill="#e0d0a8" stroke="#8B6914" strokeWidth="0.4"/>
      <path d="M13 14 Q14 14 14 13 L14 12 L12 12 L12 14" fill="#e0d0a8" stroke="#8B6914" strokeWidth="0.4"/>
      <rect x="5" y="4" width="6" height="0.8" fill="#8B6914" opacity="0.4"/>
      <rect x="5" y="6" width="6" height="0.8" fill="#8B6914" opacity="0.4"/>
      <rect x="5" y="8" width="4" height="0.8" fill="#8B6914" opacity="0.4"/>
    </svg>
  );
}

export function IconPerson({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" fill="#808080" stroke="#404040" strokeWidth="0.5"/>
      <path d="M3 14 Q3 10 8 10 Q13 10 13 14" fill="#808080" stroke="#404040" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconFlag({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="1.5" height="12" fill="#404040"/>
      <polygon points="5,2 14,5 5,8" fill="#ff0000" stroke="#aa0000" strokeWidth="0.5"/>
      <rect x="2" y="13" width="5" height="1.5" fill="#808080"/>
    </svg>
  );
}

export function IconCard({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="10" height="14" rx="1" fill="white" stroke="#000" strokeWidth="0.7"/>
      <rect x="5" y="0" width="10" height="14" rx="1" fill="white" stroke="#000" strokeWidth="0.5"/>
      <text x="7.5" y="7" textAnchor="middle" fill="#cc0000" fontSize="6" fontWeight="bold" fontFamily="serif">A</text>
      <text x="10" y="13" textAnchor="middle" fill="#cc0000" fontSize="5" fontFamily="serif">{'\u2660'}</text>
    </svg>
  );
}

export function IconComputer({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="9" rx="0.5" fill="#c0c0c0" stroke="#000" strokeWidth="0.7"/>
      <rect x="3" y="2.5" width="10" height="6" fill="#000080" stroke="#808080" strokeWidth="0.5"/>
      <rect x="5" y="4" width="6" height="1" fill="#00ff00"/>
      <rect x="5" y="6" width="4" height="1" fill="#00ff00" opacity="0.6"/>
      <rect x="5" y="10" width="6" height="1.5" fill="#a0a0a0"/>
      <rect x="3" y="11.5" width="10" height="1.5" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.3"/>
      <rect x="1" y="13" width="14" height="2" rx="0.5" fill="#d0d0d0" stroke="#808080" strokeWidth="0.3"/>
    </svg>
  );
}

export function IconNotepad({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" fill="white" stroke="#808080" strokeWidth="0.7"/>
      <rect x="2" y="1" width="12" height="2.5" fill="#000080"/>
      <line x1="4" y1="5.5" x2="12" y2="5.5" stroke="#c0c0c0" strokeWidth="0.4"/>
      <line x1="4" y1="7.5" x2="12" y2="7.5" stroke="#c0c0c0" strokeWidth="0.4"/>
      <line x1="4" y1="9.5" x2="12" y2="9.5" stroke="#c0c0c0" strokeWidth="0.4"/>
      <line x1="4" y1="11.5" x2="12" y2="11.5" stroke="#c0c0c0" strokeWidth="0.4"/>
      <rect x="4" y="5" width="5" height="1" fill="#000080" opacity="0.5"/>
      <rect x="4" y="7" width="7" height="1" fill="#000080" opacity="0.3"/>
    </svg>
  );
}

export function IconTrash({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="11" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.7"/>
      <rect x="2" y="2" width="12" height="2" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <rect x="6" y="1" width="4" height="2" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <line x1="5.5" y1="5.5" x2="5.5" y2="12" stroke="#808080" strokeWidth="0.5"/>
      <line x1="8" y1="5.5" x2="8" y2="12" stroke="#808080" strokeWidth="0.5"/>
      <line x1="10.5" y1="5.5" x2="10.5" y2="12" stroke="#808080" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconGear({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="#c0c0c0" stroke="#404040" strokeWidth="0.5"/>
      <circle cx="8" cy="8" r="1.5" fill="#808080"/>
      {[0,45,90,135,180,225,270,315].map(deg => (
        <rect key={deg} x="7" y="2" width="2" height="3" fill="#808080" stroke="#404040" strokeWidth="0.3"
          transform={`rotate(${deg} 8 8)`}/>
      ))}
    </svg>
  );
}

export function IconFolder({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="5" width="14" height="9" rx="0.5" fill="#ffcc00" stroke="#000" strokeWidth="0.7"/>
      <path d="M1 5 L6 5 L7 3 L1 3 Z" fill="#ffdd44" stroke="#000" strokeWidth="0.5"/>
    </svg>
  );
}

export function IconStart({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" fill="#ff0000"/>
      <rect x="9" y="1" width="6" height="6" fill="#00aa00"/>
      <rect x="1" y="9" width="6" height="6" fill="#0060c0"/>
      <rect x="9" y="9" width="6" height="6" fill="#ffcc00"/>
    </svg>
  );
}

export function IconWallet({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1" fill="#8B6914" stroke="#000" strokeWidth="0.7"/>
      <rect x="1" y="5" width="14" height="8" rx="1" fill="#a07818"/>
      <rect x="10" y="7" width="4" height="3" rx="0.5" fill="#c0a040" stroke="#5a4010" strokeWidth="0.5"/>
      <circle cx="12" cy="8.5" r="0.8" fill="#5a4010"/>
    </svg>
  );
}

export function IconMail16({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="9" fill="#f0e068" stroke="#808080" strokeWidth="0.5"/>
      <path d="M1 4 L8 9 L15 4" stroke="#c0a020" strokeWidth="0.5" fill="none"/>
    </svg>
  );
}

export function IconBrain({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="7" rx="5" ry="5.5" fill="#e0a0c0" stroke="#a06080" strokeWidth="0.7"/>
      <path d="M8 2 L8 12" stroke="#c08090" strokeWidth="0.5"/>
      <path d="M5 4 Q8 6 5 9" stroke="#c08090" strokeWidth="0.5" fill="none"/>
      <path d="M11 4 Q8 6 11 9" stroke="#c08090" strokeWidth="0.5" fill="none"/>
      <rect x="6" y="12" width="4" height="2" rx="0.5" fill="#c0c0c0" stroke="#808080" strokeWidth="0.3"/>
    </svg>
  );
}

export function IconLeaderboard({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="4" height="6" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <rect x="6" y="3" width="4" height="11" fill="#ffd700" stroke="#808080" strokeWidth="0.5"/>
      <rect x="11" y="6" width="4" height="8" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <text x="8" y="8" textAnchor="middle" fill="#000" fontSize="5" fontWeight="bold">1</text>
    </svg>
  );
}

export function IconChat({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="10" rx="1" fill="white" stroke="#000080" strokeWidth="0.7"/>
      <rect x="3" y="3.5" width="6" height="1" fill="#000080" opacity="0.4"/>
      <rect x="3" y="5.5" width="8" height="1" fill="#000080" opacity="0.3"/>
      <rect x="3" y="7.5" width="5" height="1" fill="#000080" opacity="0.2"/>
      <polygon points="4,11 7,11 4,14" fill="white" stroke="#000080" strokeWidth="0.7"/>
    </svg>
  );
}

export function IconGlobe({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill="#008080" stroke="#000" strokeWidth="0.7"/>
      <ellipse cx="8" cy="8" rx="3" ry="6.5" fill="none" stroke="#004040" strokeWidth="0.5"/>
      <line x1="1.5" y1="6" x2="14.5" y2="6" stroke="#004040" strokeWidth="0.4"/>
      <line x1="1.5" y1="10" x2="14.5" y2="10" stroke="#004040" strokeWidth="0.4"/>
    </svg>
  );
}

export function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="3" x2="13" y2="13" stroke="#c00000" strokeWidth="2"/>
      <line x1="13" y1="3" x2="3" y2="13" stroke="#c00000" strokeWidth="2"/>
    </svg>
  );
}

export function IconMemo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" fill="#ffffcc" stroke="#808080" strokeWidth="0.7"/>
      <line x1="4" y1="4" x2="12" y2="4" stroke="#808080" strokeWidth="0.4"/>
      <line x1="4" y1="6.5" x2="12" y2="6.5" stroke="#808080" strokeWidth="0.4"/>
      <line x1="4" y1="9" x2="10" y2="9" stroke="#808080" strokeWidth="0.4"/>
      <line x1="11" y1="11" x2="14" y2="14" stroke="#000080" strokeWidth="1"/>
      <line x1="14" y1="11" x2="11" y2="14" stroke="#000080" strokeWidth="0.3"/>
    </svg>
  );
}

export function IconErrorX({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#cc0000" strokeWidth="1"/>
      <line x1="10" y1="10" x2="22" y2="22" stroke="white" strokeWidth="3"/>
      <line x1="22" y1="10" x2="10" y2="22" stroke="white" strokeWidth="3"/>
    </svg>
  );
}

export function IconInfoBlue({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill="white" stroke="#000080" strokeWidth="2"/>
      <circle cx="16" cy="16" r="10" fill="#000080"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="serif">i</text>
    </svg>
  );
}

export function IconRobot({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="8" width="20" height="18" rx="2" fill="#c0c0c0" stroke="#404040" strokeWidth="1"/>
      <rect x="10" y="12" width="4" height="4" rx="1" fill="#000080"/>
      <rect x="18" y="12" width="4" height="4" rx="1" fill="#000080"/>
      <rect x="12" y="20" width="8" height="2" fill="#404040"/>
      <line x1="16" y1="4" x2="16" y2="8" stroke="#808080" strokeWidth="1.5"/>
      <circle cx="16" cy="3" r="2" fill="#ff0000"/>
      <rect x="3" y="14" width="3" height="6" rx="1" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
      <rect x="26" y="14" width="3" height="6" rx="1" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/>
    </svg>
  );
}
