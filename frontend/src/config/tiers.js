export const TIERS = [
  { id: 'SOLO_CODER', minDevs: 1, label: 'Solo Coder', icon: '\u{1F4BB}' },
  { id: 'INDIE_LAB', minDevs: 3, label: 'Indie Lab', icon: '\u{1F3E0}' },
  { id: 'STARTUP_HQ', minDevs: 5, label: 'Startup HQ', icon: '\u{1F680}' },
  { id: 'DEV_HOUSE', minDevs: 10, label: 'Dev House', icon: '\u{1F3E2}' },
  { id: 'TECH_CORP', minDevs: 20, label: 'Tech Corp', icon: '\u{1F3ED}' },
  { id: 'MEGA_CORP', minDevs: 50, label: 'Mega Corp', icon: '\u{1F306}' },
  { id: 'EMPIRE', minDevs: 100, label: 'Empire', icon: '\u{1F451}' },
];

export const PROGRAM_MIN_DEVS = {
  // Tier 2 — Indie Lab (3 devs)
  'world-chat': 3,
  'leaderboard': 3,
  'dev-academy': 3,

  // Tier 3 — Startup HQ (5 devs)
  'protocol-market': 5,
  'ai-lab': 5,
  'corp-wars': 5,
  'mega-sentinel': 5,

  // Tier 4 — Dev House (10 devs)
  'monad-city': 10,
  'monad-build': 10,
  'netwatch': 10,

  // Tier 5 — Tech Corp (20 devs)
  'flow': 20,
  'nadwatch': 20,
  'parallax': 20,
};

export function getTier(devCount) {
  let tier = { id: 'NONE', minDevs: 0, label: 'No Devs', icon: '?' };
  for (const t of TIERS) {
    if (devCount >= t.minDevs) tier = t;
  }
  return tier;
}

export function getNextTier(devCount) {
  for (const t of TIERS) {
    if (devCount < t.minDevs) return t;
  }
  return null;
}

export function canAccessProgram(programId, devCount) {
  const minDevs = PROGRAM_MIN_DEVS[programId] || 0;
  return devCount >= minDevs;
}
