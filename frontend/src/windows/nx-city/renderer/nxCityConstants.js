// Pure constants for the NX CITY canvas renderer.
// No React, no DOM. Imported by archetypes and the renderer module.

export const GRID_SIZE = 120;
export const BLOCK_SIZE = 4;
export const TW = 22;
export const TH = 11;

export const ZONE = {
  DOWNTOWN: 0,
  MIXED: 1,
  RESIDENTIAL: 2,
  INDUSTRIAL: 3,
  ENTERTAINMENT: 4,
};

export const TIERS = [
  { idx: 0, name: 'OUTPOST',    min: 0,     max: 500 },
  { idx: 1, name: 'SETTLEMENT', min: 500,   max: 2000 },
  { idx: 2, name: 'TOWN',       min: 2000,  max: 5000 },
  { idx: 3, name: 'DISTRICT',   min: 5000,  max: 10000 },
  { idx: 4, name: 'METROPOLIS', min: 10000, max: 20000 },
  { idx: 5, name: 'MEGACITY',   min: 20000, max: 35000 },
];

export function getTier(n) {
  for (const t of TIERS) if (n >= t.min && n < t.max) return t;
  return TIERS[TIERS.length - 1];
}

export const FACADES = [
  { base: '#6c6876', light: '#8a8696', dark: '#4a4654', tag: 'gray' },
  { base: '#6a7184', light: '#868fa2', dark: '#464c5c', tag: 'blue-gray' },
  { base: '#7a5a48', light: '#967258', dark: '#533c30', tag: 'brick' },
  { base: '#5a6a60', light: '#748a78', dark: '#3c4840', tag: 'green-steel' },
  { base: '#7c4848', light: '#985c5c', dark: '#532e2e', tag: 'rust' },
  { base: '#665068', light: '#806480', dark: '#443346', tag: 'purple-gray' },
  { base: '#6e6650', light: '#8a8062', dark: '#4a4234', tag: 'ocher' },
  { base: '#4e6470', light: '#68818e', dark: '#34424c', tag: 'teal' },
  { base: '#7a7468', light: '#968e80', dark: '#524d44', tag: 'stone' },
  { base: '#4a506a', light: '#646a8a', dark: '#303448', tag: 'navy' },
];

export const NEONS = ['#FF00AA', '#00F0FF', '#FFB000', '#B066FF', '#00FF99', '#FF3355', '#FFF066'];

export const VTYPES = [
  { type: 'sedan',  size: [4, 1.6],   speed: 0.0018, colors: ['#FF00AA', '#00F0FF', '#FFB000', '#FFFFFF', '#FF3355', '#B066FF', '#00FF99'] },
  { type: 'sports', size: [4.5, 1.6], speed: 0.0038, colors: ['#FF3355', '#FFF066', '#00F0FF', '#FF00AA'] },
  { type: 'truck',  size: [6, 2],     speed: 0.0010, colors: ['#6a6a6a', '#704030', '#4a4a50', '#804020'] },
  { type: 'van',    size: [5, 2],     speed: 0.0014, colors: ['#FFFFFF', '#c0c0c0', '#a08060', '#408060'] },
  { type: 'bus',    size: [8, 2.2],   speed: 0.0012, colors: ['#FFB000', '#FF6020', '#40A060'] },
];

export const WEATHER_TYPES = {
  CLEAR:      { dur: [0, 0],    weight: 0,  label: 'CLEAR' },
  RAIN_LIGHT: { dur: [30, 60],  weight: 20, label: 'RAIN' },
  STORM:      { dur: [60, 120], weight: 12, label: 'STORM' },
  WIND:       { dur: [40, 60],  weight: 18, label: 'WIND' },
  FOG:        { dur: [60, 100], weight: 15, label: 'FOG',       phase: ['DAWN', 'DUSK', 'NIGHT'] },
  UFO:        { dur: [20, 25],  weight: 6,  label: 'UFO',       phase: ['NIGHT'] },
  FIREWORKS:  { dur: [35, 45],  weight: 10, label: 'FIREWORKS' },
  METEOR:     { dur: [20, 30],  weight: 8,  label: 'METEORS',   phase: ['NIGHT'] },
  AURORA:     { dur: [40, 60],  weight: 11, label: 'AURORA',    phase: ['NIGHT'] },
};

// Hash + RNG + color helpers (FNV-1a-ish + xorshift)
export function hash32(str) {
  if (typeof str === 'number') str = '' + str;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function sRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) >>> 0;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.floor(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.floor(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.floor((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mixColors(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b_ = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b_})`;
}

// --- Time helpers (user local clock) ---

export function daylightFactor() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const raw = -Math.cos(((h - 12) / 24) * Math.PI * 2);
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

export function currentPhase() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 5 && h < 7) return 'DAWN';
  if (h >= 7 && h < 17) return 'DAY';
  if (h >= 17 && h < 19) return 'DUSK';
  return 'NIGHT';
}
