// Centralized sound effects. All helpers bail out early if the user has
// muted sound via the taskbar toggle (localStorage 'nx-sound' === 'off').
//
// Moved here from inline copies in Desktop.jsx (_playSound) and MyDevs.jsx
// (playSpendSound / playGainSound / playActionSound) so there's a single
// place to gate muting and a single set of waveforms to tweak.

export function isSoundEnabled() {
  try {
    return localStorage.getItem('nx-sound') !== 'off';
  } catch {
    return true;
  }
}

// Generic square-wave tone sequence. Accepts a list of frequencies, each
// held for ~0.05s, with an exponential decay down to ~0.01 gain over `dur`.
export function playTones(freqs, dur = 0.2, gain = 0.1) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'square';
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.05));
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

// Descending blip for spending $NXT / energy.
export function playSpendSound() {
  playTones([800, 600, 400], 0.2, 0.12);
}

// Ascending arpeggio for gaining $NXT / rewards.
export function playGainSound() {
  playTones([400, 600, 800, 1000], 0.25, 0.12);
}

// Neutral two-tone chirp for generic actions.
export function playActionSound() {
  playTones([500, 700], 0.15, 0.1);
}

// Short click for the sound toggle itself. This one intentionally does
// NOT check isSoundEnabled() — we want feedback on the click that just
// re-enabled sound. Callers that need muted behavior should use one of
// the gated helpers above.
export function playToggleClick() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 300);
  } catch {}
}
