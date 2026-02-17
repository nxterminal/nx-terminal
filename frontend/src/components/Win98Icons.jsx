// Windows 2000 style icons — smoother gradients, richer colors, anti-aliased look

function IconMyPC({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="monGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e8e0" />
          <stop offset="100%" stopColor="#b8b8a8" />
        </linearGradient>
        <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a3a6a" />
          <stop offset="100%" stopColor="#0a1a3a" />
        </linearGradient>
      </defs>
      <rect x="3" y="2" width="26" height="20" rx="2" fill="url(#monGrad)" stroke="#666" strokeWidth="0.8" />
      <rect x="5" y="4" width="22" height="15" rx="1" fill="url(#screenGrad)" />
      <text x="10" y="14" fontFamily="monospace" fontSize="8" fill="#4a9aff" fontWeight="bold">NX</text>
      <circle cx="16" cy="20.5" r="0.8" fill="#33cc33" />
      <rect x="11" y="22" width="10" height="2" rx="0.5" fill="url(#monGrad)" stroke="#888" strokeWidth="0.5" />
      <rect x="8" y="24" width="16" height="3" rx="1" fill="url(#monGrad)" stroke="#888" strokeWidth="0.5" />
    </svg>
  );
}

function IconLiveFeed({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="person1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b9bd5" />
          <stop offset="100%" stopColor="#2e75b6" />
        </linearGradient>
        <linearGradient id="person2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#70ad47" />
          <stop offset="100%" stopColor="#4a8c2a" />
        </linearGradient>
      </defs>
      <circle cx="11" cy="8" r="4" fill="#ffd5a0" stroke="#cc9966" strokeWidth="0.5" />
      <path d="M4 24 Q4 16 11 16 Q18 16 18 24" fill="url(#person1)" stroke="#1a5a8a" strokeWidth="0.5" />
      <circle cx="21" cy="8" r="4" fill="#ffd5a0" stroke="#cc9966" strokeWidth="0.5" />
      <path d="M14 24 Q14 16 21 16 Q28 16 28 24" fill="url(#person2)" stroke="#3a6c1a" strokeWidth="0.5" />
      <path d="M14 11 Q16 9 18 11" fill="none" stroke="#ffa500" strokeWidth="0.8" opacity="0.7" />
      <path d="M13 13 Q16 10 19 13" fill="none" stroke="#ffa500" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

function IconGlobe({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="globeGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#6ab7ff" />
          <stop offset="60%" stopColor="#2e75b6" />
          <stop offset="100%" stopColor="#1a3a6a" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#globeGrad)" stroke="#1a3a6a" strokeWidth="0.8" />
      <ellipse cx="12" cy="12" rx="4" ry="3" fill="#4a9a4a" opacity="0.8" />
      <ellipse cx="20" cy="15" rx="3" ry="5" fill="#4a9a4a" opacity="0.7" />
      <ellipse cx="11" cy="20" rx="3" ry="2" fill="#4a9a4a" opacity="0.6" />
      <ellipse cx="16" cy="16" rx="13" ry="6" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <ellipse cx="16" cy="16" rx="6" ry="13" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <line x1="3" y1="16" x2="29" y2="16" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <ellipse cx="12" cy="10" rx="5" ry="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

function IconTrophy({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trophyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#f0c000" />
          <stop offset="100%" stopColor="#cc9900" />
        </linearGradient>
      </defs>
      <path d="M9 4 L23 4 L21 16 Q16 20 11 16 Z" fill="url(#trophyGrad)" stroke="#aa8800" strokeWidth="0.7" />
      <path d="M9 6 Q3 6 3 11 Q3 15 8 15" fill="none" stroke="url(#trophyGrad)" strokeWidth="2" />
      <path d="M23 6 Q29 6 29 11 Q29 15 24 15" fill="none" stroke="url(#trophyGrad)" strokeWidth="2" />
      <rect x="14" y="18" width="4" height="4" rx="0.5" fill="url(#trophyGrad)" stroke="#aa8800" strokeWidth="0.5" />
      <rect x="10" y="22" width="12" height="3" rx="1" fill="url(#trophyGrad)" stroke="#aa8800" strokeWidth="0.5" />
      <polygon points="16,7 17.2,10 20.5,10 18,12 19,15.5 16,13.5 13,15.5 14,12 11.5,10 14.8,10" fill="#fff8dc" opacity="0.8" />
      <path d="M11 5 L12 15" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    </svg>
  );
}

function IconChart({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8e8e8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="1" fill="url(#chartBg)" stroke="#888" strokeWidth="0.7" />
      <line x1="6" y1="8" x2="6" y2="24" stroke="#ccc" strokeWidth="0.5" />
      <line x1="6" y1="24" x2="28" y2="24" stroke="#ccc" strokeWidth="0.5" />
      <line x1="6" y1="16" x2="28" y2="16" stroke="#eee" strokeWidth="0.3" />
      <line x1="6" y1="12" x2="28" y2="12" stroke="#eee" strokeWidth="0.3" />
      <line x1="6" y1="20" x2="28" y2="20" stroke="#eee" strokeWidth="0.3" />
      <rect x="8" y="18" width="3" height="6" rx="0.3" fill="#e74c3c" />
      <rect x="12" y="14" width="3" height="10" rx="0.3" fill="#2ecc71" />
      <rect x="16" y="10" width="3" height="14" rx="0.3" fill="#3498db" />
      <rect x="20" y="12" width="3" height="12" rx="0.3" fill="#f39c12" />
      <rect x="24" y="8" width="3" height="16" rx="0.3" fill="#9b59b6" />
      <polyline points="9.5,17 13.5,13 17.5,9 21.5,11 25.5,7" fill="none" stroke="#e74c3c" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconLab({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flaskGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f5e9" />
          <stop offset="100%" stopColor="#a5d6a7" />
        </linearGradient>
        <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#66bb6a" />
          <stop offset="100%" stopColor="#2e7d32" />
        </linearGradient>
      </defs>
      <rect x="13" y="2" width="6" height="8" rx="1" fill="url(#flaskGrad)" stroke="#888" strokeWidth="0.6" />
      <path d="M13 10 L6 24 Q6 28 10 28 L22 28 Q26 28 26 24 L19 10 Z" fill="url(#flaskGrad)" stroke="#888" strokeWidth="0.6" />
      <path d="M8 20 L24 20 L26 24 Q26 28 22 28 L10 28 Q6 28 6 24 Z" fill="url(#liquidGrad)" opacity="0.8" />
      <circle cx="14" cy="23" r="1.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="18" cy="21" r="1" fill="rgba(255,255,255,0.4)" />
      <circle cx="16" cy="25" r="0.8" fill="rgba(255,255,255,0.4)" />
      <circle cx="15" cy="17" r="0.6" fill="rgba(255,255,255,0.3)" />
      <rect x="12.5" y="1" width="7" height="2" rx="0.5" fill="#d4a373" stroke="#a67c52" strokeWidth="0.4" />
    </svg>
  );
}

function IconFolder({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="folderGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd54f" />
          <stop offset="100%" stopColor="#f9a825" />
        </linearGradient>
        <linearGradient id="folderFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe082" />
          <stop offset="100%" stopColor="#ffca28" />
        </linearGradient>
      </defs>
      <path d="M2 8 L2 26 Q2 27 3 27 L29 27 Q30 27 30 26 L30 10 Q30 9 29 9 L15 9 L13 6 Q12.5 5 12 5 L3 5 Q2 5 2 6 Z" fill="url(#folderGrad)" stroke="#c89000" strokeWidth="0.6" />
      <path d="M2 12 L30 12 L30 26 Q30 27 29 27 L3 27 Q2 27 2 26 Z" fill="url(#folderFront)" stroke="#c89000" strokeWidth="0.4" />
      <line x1="4" y1="12" x2="28" y2="12" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
      <rect x="8" y="7" width="14" height="4" rx="0.5" fill="#fff" opacity="0.3" />
    </svg>
  );
}

function IconMail({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mailGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e0d8" />
        </linearGradient>
      </defs>
      <rect x="2" y="7" width="28" height="19" rx="1.5" fill="url(#mailGrad)" stroke="#888" strokeWidth="0.7" />
      <path d="M2 7 L16 18 L30 7" fill="none" stroke="#888" strokeWidth="0.7" />
      <path d="M2.5 7.5 L16 17.5 L29.5 7.5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="3" />
      <path d="M2 26 L11 18" fill="none" stroke="#aaa" strokeWidth="0.4" />
      <path d="M30 26 L21 18" fill="none" stroke="#aaa" strokeWidth="0.4" />
    </svg>
  );
}

function IconBriefcase({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8d6e63" />
          <stop offset="50%" stopColor="#6d4c41" />
          <stop offset="100%" stopColor="#5d4037" />
        </linearGradient>
      </defs>
      <path d="M12 8 L12 5 Q12 3 14 3 L18 3 Q20 3 20 5 L20 8" fill="none" stroke="#5d4037" strokeWidth="1.5" />
      <rect x="2" y="8" width="28" height="18" rx="2" fill="url(#caseGrad)" stroke="#4e342e" strokeWidth="0.7" />
      <rect x="14" y="14" width="4" height="3" rx="0.5" fill="#ffd54f" stroke="#c89000" strokeWidth="0.5" />
      <circle cx="16" cy="15.5" r="0.6" fill="#4e342e" />
      <line x1="2" y1="15" x2="14" y2="15" stroke="#4e342e" strokeWidth="0.8" />
      <line x1="18" y1="15" x2="30" y2="15" stroke="#4e342e" strokeWidth="0.8" />
      <rect x="4" y="9" width="24" height="1" rx="0.3" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

function IconSettings({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gearGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="100%" stopColor="#78909c" />
        </linearGradient>
      </defs>
      <path d="M16 2 L18 2 L18.5 5 L20 5.5 L22.5 3.5 L24 5 L22 7.5 L22.5 9 L25.5 9.5 L25.5 11.5 L22.5 12 L22 13.5 L24 16 L22.5 17.5 L20 15.5 L18.5 16 L18 19 L16 19 L15.5 16 L14 15.5 L11.5 17.5 L10 16 L12 13.5 L11.5 12 L8.5 11.5 L8.5 9.5 L11.5 9 L12 7.5 L10 5 L11.5 3.5 L14 5.5 L15.5 5 Z" fill="url(#gearGrad)" stroke="#546e7a" strokeWidth="0.5" />
      <circle cx="17" cy="10.5" r="3" fill="#eceff1" stroke="#546e7a" strokeWidth="0.5" />
      <circle cx="22" cy="22" r="5" fill="url(#gearGrad)" stroke="#546e7a" strokeWidth="0.5" />
      <path d="M22 17 L23 17 L23.3 18.5 L24.3 19 L25.5 18 L26.5 19 L25.5 20.2 L26 21.2 L27.5 21.5 L27.5 22.5 L26 22.8 L25.5 23.8 L26.5 25 L25.5 26 L24.3 25 L23.3 25.5 L23 27 L22 27 L21.7 25.5 L20.7 25 L19.5 26 L18.5 25 L19.5 23.8 L19 22.8 L17.5 22.5 L17.5 21.5 L19 21.2 L19.5 20.2 L18.5 19 L19.5 18 L20.7 19 L21.7 18.5 Z" fill="url(#gearGrad)" stroke="#546e7a" strokeWidth="0.4" />
      <circle cx="22" cy="22" r="2" fill="#eceff1" stroke="#546e7a" strokeWidth="0.4" />
    </svg>
  );
}

function IconBug({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bugGrad" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#66bb6a" />
          <stop offset="100%" stopColor="#2e7d32" />
        </radialGradient>
      </defs>
      <path d="M12 8 Q10 3 7 2" fill="none" stroke="#333" strokeWidth="1" strokeLinecap="round" />
      <path d="M20 8 Q22 3 25 2" fill="none" stroke="#333" strokeWidth="1" strokeLinecap="round" />
      <circle cx="7" cy="2" r="1" fill="#ff5722" />
      <circle cx="25" cy="2" r="1" fill="#ff5722" />
      <ellipse cx="16" cy="9" rx="5" ry="4" fill="url(#bugGrad)" stroke="#1b5e20" strokeWidth="0.6" />
      <circle cx="13.5" cy="8" r="1.5" fill="#fff" />
      <circle cx="18.5" cy="8" r="1.5" fill="#fff" />
      <circle cx="13.5" cy="8" r="0.8" fill="#333" />
      <circle cx="18.5" cy="8" r="0.8" fill="#333" />
      <ellipse cx="16" cy="19" rx="8" ry="9" fill="url(#bugGrad)" stroke="#1b5e20" strokeWidth="0.6" />
      <line x1="16" y1="11" x2="16" y2="27" stroke="#1b5e20" strokeWidth="0.5" />
      <circle cx="12" cy="17" r="1" fill="rgba(0,0,0,0.15)" />
      <circle cx="20" cy="17" r="1" fill="rgba(0,0,0,0.15)" />
      <circle cx="12" cy="22" r="0.8" fill="rgba(0,0,0,0.15)" />
      <circle cx="20" cy="22" r="0.8" fill="rgba(0,0,0,0.15)" />
      <line x1="9" y1="14" x2="4" y2="12" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="23" y1="14" x2="28" y2="12" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="8" y1="19" x2="3" y2="19" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="24" y1="19" x2="29" y2="19" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="9" y1="24" x2="4" y2="26" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="23" y1="24" x2="28" y2="26" stroke="#333" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCards({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardBack2k" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a3a6a" />
          <stop offset="100%" stopColor="#0a1a3a" />
        </linearGradient>
      </defs>
      <rect x="6" y="3" width="18" height="24" rx="2" fill="url(#cardBack2k)" stroke="#4a6a9a" strokeWidth="0.7" transform="rotate(-8 15 15)" />
      <text x="12" y="18" fontFamily="monospace" fontSize="6" fill="#6a9adf" fontWeight="bold" transform="rotate(-8 15 15)">NX</text>
      <rect x="8" y="4" width="18" height="24" rx="2" fill="#fffff8" stroke="#888" strokeWidth="0.7" />
      <text x="10" y="11" fontSize="7" fill="#cc0000" fontWeight="bold">A</text>
      <text x="10" y="17" fontSize="9" fill="#cc0000">{'\u2665'}</text>
      <text x="22" y="26" fontSize="7" fill="#cc0000" fontWeight="bold" textAnchor="end" transform="rotate(180 21 23)">A</text>
    </svg>
  );
}

function IconClipboard({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="clipGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e8e0" />
          <stop offset="100%" stopColor="#c8c8b8" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="22" height="25" rx="1.5" fill="url(#clipGrad)" stroke="#888" strokeWidth="0.7" />
      <rect x="10" y="2" width="12" height="5" rx="1" fill="#a0522d" stroke="#6b3410" strokeWidth="0.6" />
      <circle cx="16" cy="4.5" r="1.5" fill="#c8c8b8" stroke="#888" strokeWidth="0.5" />
      <line x1="9" y1="12" x2="23" y2="12" stroke="#4a8c2a" strokeWidth="1" />
      <line x1="9" y1="16" x2="21" y2="16" stroke="#555" strokeWidth="0.6" />
      <line x1="9" y1="19" x2="19" y2="19" stroke="#555" strokeWidth="0.6" />
      <line x1="9" y1="22" x2="22" y2="22" stroke="#555" strokeWidth="0.6" />
      <line x1="9" y1="25" x2="17" y2="25" stroke="#555" strokeWidth="0.6" />
    </svg>
  );
}

function IconNotepad({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="noteGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffff0" />
          <stop offset="100%" stopColor="#f5f5dc" />
        </linearGradient>
      </defs>
      <rect x="4" y="2" width="24" height="28" rx="1" fill="url(#noteGrad)" stroke="#888" strokeWidth="0.7" />
      <rect x="4" y="2" width="24" height="4" rx="1" fill="#3498db" stroke="#2980b9" strokeWidth="0.5" />
      <line x1="10" y1="2" x2="10" y2="6" stroke="#fff" strokeWidth="1.5" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="#fff" strokeWidth="1.5" />
      <line x1="22" y1="2" x2="22" y2="6" stroke="#fff" strokeWidth="1.5" />
      <line x1="8" y1="10" x2="24" y2="10" stroke="#ccc" strokeWidth="0.4" />
      <line x1="8" y1="14" x2="24" y2="14" stroke="#ccc" strokeWidth="0.4" />
      <line x1="8" y1="18" x2="24" y2="18" stroke="#ccc" strokeWidth="0.4" />
      <line x1="8" y1="22" x2="24" y2="22" stroke="#ccc" strokeWidth="0.4" />
      <line x1="8" y1="26" x2="24" y2="26" stroke="#ccc" strokeWidth="0.4" />
      <text x="8" y="13" fontSize="4" fill="#333" fontFamily="monospace">TODO: buy dip</text>
      <text x="8" y="17" fontSize="4" fill="#888" fontFamily="monospace">HODL forever...</text>
    </svg>
  );
}

function IconRecycleBin({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="binGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="100%" stopColor="#78909c" />
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="24" height="3" rx="0.5" fill="url(#binGrad)" stroke="#546e7a" strokeWidth="0.6" />
      <rect x="12" y="4" width="8" height="3" rx="0.5" fill="url(#binGrad)" stroke="#546e7a" strokeWidth="0.5" />
      <path d="M6 9 L8 28 Q8 29 9 29 L23 29 Q24 29 24 28 L26 9 Z" fill="url(#binGrad)" stroke="#546e7a" strokeWidth="0.6" />
      <line x1="12" y1="12" x2="12.5" y2="26" stroke="#546e7a" strokeWidth="0.7" />
      <line x1="16" y1="12" x2="16" y2="26" stroke="#546e7a" strokeWidth="0.7" />
      <line x1="20" y1="12" x2="19.5" y2="26" stroke="#546e7a" strokeWidth="0.7" />
      <text x="16" y="21" textAnchor="middle" fontSize="5" fill="#e74c3c" fontWeight="bold" opacity="0.6">$</text>
    </svg>
  );
}

export const ICON_MAP = {
  'nx-terminal': IconMyPC,
  'live-feed': IconLiveFeed,
  'world-chat': IconGlobe,
  'leaderboard': IconTrophy,
  'protocol-market': IconChart,
  'ai-lab': IconLab,
  'my-devs': IconClipboard,
  'inbox': IconMail,
  'hire-devs': IconBriefcase,
  'control-panel': IconSettings,
  'bug-sweeper': IconBug,
  'protocol-solitaire': IconCards,
  'notepad': IconNotepad,
  'recycle-bin': IconRecycleBin,
};

export function Win98Icon({ id, size = 32 }) {
  const IconComponent = ICON_MAP[id];
  if (!IconComponent) return null;
  return <IconComponent size={size} />;
}
