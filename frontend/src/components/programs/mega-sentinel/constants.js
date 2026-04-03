export const COLORS = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
  dimGreen: '#065f46',
  dimAmber: '#78350f',
  dimRed: '#7f1d1d',
  bg: '#0b0b0f',
  bgPanel: '#141418',
  border: '#1e1e2a',
  borderLight: '#2a2a3a',
  muted: '#64748b',
  text: '#e2e8f0',
  textDim: '#94a3b8',
};

export const MODULES = [
  { id: 'xray', label: 'XRAY.mega', desc: 'Token Scanner' },
  { id: 'firewall', label: 'FIREWALL.exe', desc: 'Wallet Antivirus' },
  { id: 'autopsy', label: 'RUG AUTOPSY', desc: 'Forensic Analysis' },
  { id: 'hologram', label: 'HOLOGRAM', desc: 'Legitimacy Check' },
  { id: 'graduation', label: 'GRADUATION', desc: 'Token Tracker' },
];

export const RISK_LEVELS = {
  SAFE: { label: 'SAFE', color: COLORS.green, bg: 'rgba(16,185,129,0.1)' },
  WARNING: { label: 'WARNING', color: COLORS.amber, bg: 'rgba(245,158,11,0.1)' },
  DANGER: { label: 'DANGER', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  CRITICAL: { label: 'CRITICAL', color: COLORS.red, bg: 'rgba(239,68,68,0.1)' },
};

export function getRiskLevel(score) {
  if (score >= 80) return RISK_LEVELS.SAFE;
  if (score >= 60) return RISK_LEVELS.WARNING;
  if (score >= 40) return RISK_LEVELS.DANGER;
  return RISK_LEVELS.CRITICAL;
}
