export const COLORS = {
  green: '#33ff33',
  amber: '#ffb700',
  red: '#ff3333',
  cyan: '#00e5ff',
  dimGreen: '#1a8c1a',
  dimAmber: '#8c6500',
  dimRed: '#8c1a1a',
  bg: '#0a0a0a',
  bgPanel: '#0f0f0f',
  border: '#1a3a1a',
  muted: '#555',
  text: '#c0c0c0',
};

export const MODULES = [
  { id: 'xray', label: 'XRAY.mega', icon: '\u{1F50D}', desc: 'Token Scanner' },
  { id: 'firewall', label: 'FIREWALL.exe', icon: '\u{1F6E1}', desc: 'Wallet Antivirus' },
  { id: 'autopsy', label: 'RUG AUTOPSY', icon: '\u{1FA78}', desc: 'Forensic Analysis' },
  { id: 'hologram', label: 'HOLOGRAM', icon: '\u{1F4A0}', desc: 'Legitimacy Check' },
  { id: 'graduation', label: 'GRADUATION', icon: '\u{1F4C8}', desc: 'Token Tracker' },
];

export const BOOT_MESSAGES = [
  { text: '', delay: 0 },
  { text: 'MEGA SENTINEL v1.0', color: COLORS.green, delay: 100 },
  { text: 'Security Suite for MegaETH Ecosystem', color: COLORS.muted, delay: 250 },
  { text: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550', color: COLORS.dimGreen, delay: 400 },
  { text: '', delay: 500 },
  { text: 'Initializing modules...', color: COLORS.amber, delay: 600 },
  { text: '[\u2713] XRAY.mega .............. loaded', color: COLORS.green, delay: 900 },
  { text: '[\u2713] RUG AUTOPSY ............ loaded', color: COLORS.green, delay: 1150 },
  { text: '[\u2713] HOLOGRAM DETECTOR ...... loaded', color: COLORS.green, delay: 1400 },
  { text: '[\u2713] GRADUATION TRACKER ..... loaded', color: COLORS.green, delay: 1650 },
  { text: '[\u2713] FIREWALL.exe ........... loaded', color: COLORS.green, delay: 1900 },
  { text: '', delay: 2050 },
  { text: 'Connecting to MegaETH mainnet...', color: COLORS.cyan, delay: 2150 },
  { text: '  Chain ID: 4326 ................. OK', color: COLORS.muted, delay: 2400 },
  { text: '  Status: CONNECTED', color: COLORS.green, delay: 2600 },
  { text: '', delay: 2750 },
  { text: 'SYSTEM READY', color: COLORS.green, delay: 2900 },
];

export const BOOT_DURATION = 3400;

export const RISK_LEVELS = {
  SAFE: { label: 'SAFE', color: COLORS.green, bg: 'rgba(51,255,51,0.1)' },
  WARNING: { label: 'WARNING', color: COLORS.amber, bg: 'rgba(255,183,0,0.1)' },
  DANGER: { label: 'DANGER', color: '#ff6600', bg: 'rgba(255,102,0,0.1)' },
  CRITICAL: { label: 'CRITICAL', color: COLORS.red, bg: 'rgba(255,51,51,0.1)' },
};

export function getRiskLevel(score) {
  if (score >= 80) return RISK_LEVELS.SAFE;
  if (score >= 60) return RISK_LEVELS.WARNING;
  if (score >= 40) return RISK_LEVELS.DANGER;
  return RISK_LEVELS.CRITICAL;
}
