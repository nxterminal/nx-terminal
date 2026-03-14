// ═══ PARALLAX.exe — MONAD PARALLEL EXECUTION VISUALIZER ═══
export { COLORS } from '../nadwatch/constants';

export const NUM_LANES = 8;
export const SIM_TICK_MS = 100;
export const CANVAS_FRAME_MS = 33; // ~30fps

export const EVENT_TYPES = {
  CONFLICT: { label: 'CONFLICT', color: '#FF3333' },
  RE_EXEC:  { label: 'RE-EXEC',  color: '#FFD700' },
  CLEAR:    { label: 'CLEAR',    color: '#30FF60' },
  PARALLEL: { label: 'PARALLEL', color: '#7B2FBE' },
};

export const LANE_COLORS = [
  '#7B2FBE', '#9B59B6', '#30FF60', '#00FFFF',
  '#FFD700', '#FF3333', '#FF69B4', '#4FC3F7',
];

export const BOOT_MESSAGES = [
  { text: 'PARALLAX.exe v1.0 \u2014 MONAD PARALLEL EXECUTION VISUALIZER', color: '#7B2FBE', delay: 0 },
  { text: '(C) 2026 NX TERMINAL CORP \u2014 OPTIMISTIC CONCURRENCY DIVISION', color: '#888', delay: 200 },
  { text: '', color: '', delay: 400 },
  { text: 'CONNECTING TO MONAD RPC ENDPOINT...', color: '#30FF60', delay: 500 },
  { text: 'CHAIN ID: 10143............................... OK', color: '#888', delay: 900 },
  { text: 'BLOCK TIME: 400ms........................... OK', color: '#888', delay: 1200 },
  { text: '', color: '', delay: 1400 },
  { text: 'INITIALIZING PARALLEL EXECUTION ENGINE...', color: '#30FF60', delay: 1600 },
  { text: '  > EXECUTION LANES: 8', color: '#9B59B6', delay: 1800 },
  { text: '  > CONCURRENCY MODEL: OPTIMISTIC', color: '#9B59B6', delay: 2000 },
  { text: '  > CONFLICT DETECTION: ENABLED', color: '#9B59B6', delay: 2200 },
  { text: '  > RE-EXECUTION HANDLER: ARMED', color: '#9B59B6', delay: 2400 },
  { text: 'LOADING STATE ACCESS TRACKER................. OK', color: '#30FF60', delay: 2600 },
  { text: 'CALIBRATING SPEEDUP METRICS................. OK', color: '#30FF60', delay: 2800 },
  { text: 'PIPELINE MONITOR ONLINE..................... OK', color: '#30FF60', delay: 3000 },
  { text: '', color: '', delay: 3200 },
  { text: 'PARALLEL EXECUTION IS NOT A SIMULATION.', color: '#7B2FBE', delay: 3400 },
  { text: 'IT IS THE FUTURE.', color: '#7B2FBE', delay: 3600 },
  { text: '', color: '', delay: 3900 },
  { text: 'ENTERING PARALLAX MODE...', color: '#fff', delay: 4100 },
];
