import { useState, useEffect, useRef, useMemo } from 'react';

// HackAnimation — Phase 5.15. Compact, INLINE terminal animation. Lives
// inside the HackModal dialog (no fullscreen takeover). Green-on-black,
// VT323, with a random glitch-character overlay as the signature
// effect (the Phase 5.14 scanlines are gone).
//
// Timing contract (unchanged from Phase 5.14): the hack request runs
// in parallel; this animation is a MINIMUM wait. `responseReady` tells
// it the backend has replied. `onDone` fires once — when the scripted
// sequence AND the response are both ready, or immediately on SKIP. A
// slow response just loops the last line's dots, no visible timeout.

const MINT = '#44ffaa';
const GLITCH_CHARS = '█▓░╫╪@#$%&*?!░▒▓'.split('');
const GLITCH_COLORS = [MINT, '#ffffff', '#ff4ddd', '#4dd8ff'];

const STEP_LINES = [
  { base: '> establishing connection...', marker: true },
  { base: '> bypassing defense...', marker: true },
  { base: '> injecting payload...', marker: true },
  { base: '> extracting data...', marker: false, waiting: true },
];
const TOTAL_LINES = STEP_LINES.length + 1; // + the header line

const LINE_INTERVAL = 300;        // ms between line reveals (~2s total)
const HOLD_AFTER_LAST = 700;
const SKIP_DELAY = 1000;
const FRAME_MS = 100;             // glitch refresh + cursor/dots cadence
const MARKER_COL = 30;            // pad column for the [✓]/[▮] markers

const ALWAYS_SKIP_PREFIX = 'nx:hack_animation:always_skip:';

function alwaysSkipKey(wallet) {
  return wallet ? `${ALWAYS_SKIP_PREFIX}${wallet.toLowerCase()}` : null;
}

// Read by HackModal before an execution. Key format preserved from
// Phase 5.14 so a player's existing "always skip" choice carries over.
export function hackAnimationAlwaysSkip(wallet) {
  const key = alwaysSkipKey(wallet);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function makeGlitch() {
  const n = 12;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: i,
      ch: GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)],
      x: Math.random() * 96,
      y: Math.random() * 92,
      // Mostly mint/white; ~15% of the time a magenta/cyan colour shift.
      color: Math.random() < 0.15
        ? GLITCH_COLORS[2 + Math.floor(Math.random() * 2)]
        : GLITCH_COLORS[Math.floor(Math.random() * 2)],
      opacity: 0.3 + Math.random() * 0.2,
    });
  }
  return out;
}

export default function HackAnimation({ mode, target, responseReady, onDone, walletAddress }) {
  const [revealed, setRevealed] = useState(1); // header visible immediately
  const [scriptedDone, setScriptedDone] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [frame, setFrame] = useState(0);
  const [alwaysSkip, setAlwaysSkip] = useState(() => hackAnimationAlwaysSkip(walletAddress));
  const doneFiredRef = useRef(false);

  // Scripted line reveal + skip-button timers.
  useEffect(() => {
    const timers = [];
    for (let i = 1; i < TOTAL_LINES; i++) {
      timers.push(setTimeout(() => setRevealed(i + 1), i * LINE_INTERVAL));
    }
    timers.push(setTimeout(
      () => setScriptedDone(true),
      (TOTAL_LINES - 1) * LINE_INTERVAL + HOLD_AFTER_LAST,
    ));
    timers.push(setTimeout(() => setShowSkip(true), SKIP_DELAY));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Single fast interval: drives the glitch overlay, cursor blink and
  // the waiting-dots cadence.
  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => clearInterval(iv);
  }, []);

  // Fire onDone once, when the script AND the response are both ready.
  useEffect(() => {
    if (doneFiredRef.current) return;
    if (scriptedDone && responseReady) {
      doneFiredRef.current = true;
      onDone();
    }
  }, [scriptedDone, responseReady, onDone]);

  const handleSkip = () => {
    if (doneFiredRef.current) return;
    doneFiredRef.current = true;
    onDone();
  };

  const toggleAlwaysSkip = (checked) => {
    setAlwaysSkip(checked);
    const key = alwaysSkipKey(walletAddress);
    if (!key) return;
    try {
      if (checked) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch {
      /* private mode / quota — best effort */
    }
  };

  const glitch = useMemo(() => makeGlitch(), [frame]);
  const cursorOn = Math.floor(frame / 5) % 2 === 0;
  const dotCount = Math.floor(frame / 4) % 4;
  const waiting = scriptedDone && !responseReady;

  const headerLine = `> hack target=${target} mode=${mode}`;

  // Build the visible line list with their status markers.
  const lines = [];
  for (let i = 0; i < revealed; i++) {
    const isLast = i === revealed - 1;
    if (i === 0) {
      lines.push({ text: headerLine, isLast });
      continue;
    }
    const step = STEP_LINES[i - 1];
    if (step.waiting) {
      const text = waiting
        ? '> extracting data' + '.'.repeat(dotCount)
        : step.base;
      lines.push({ text, isLast });
    } else {
      // [✓] once a later line has appeared, [▮] while still in progress.
      const marker = i < revealed - 1 ? '[✓]' : '[▮]';
      lines.push({ text: step.base.padEnd(MARKER_COL) + marker, isLast });
    }
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#000', overflow: 'hidden',
      fontFamily: "'VT323', monospace",
    }}>
      {/* Terminal text */}
      <div style={{
        position: 'absolute', inset: 0, padding: '20px 22px',
        color: MINT, fontSize: 'var(--text-lg)', lineHeight: 1.6,
        textShadow: `0 0 6px ${MINT}66`, zIndex: 1, whiteSpace: 'pre',
      }}>
        {lines.map((ln, idx) => (
          <div key={idx}>
            {ln.text}
            {ln.isLast && (
              <span style={{ opacity: cursorOn ? 1 : 0 }}>{'█'}</span>
            )}
          </div>
        ))}
      </div>

      {/* Glitch-character overlay — the Phase 5.15 signature effect */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
        {glitch.map((g) => (
          <span key={g.id} style={{
            position: 'absolute', left: `${g.x}%`, top: `${g.y}%`,
            color: g.color, opacity: g.opacity, fontSize: 'var(--text-lg)',
            textShadow: `0 0 4px ${g.color}`,
          }}>{g.ch}</span>
        ))}
      </div>

      {/* SKIP — small, top-right, after 1s */}
      {showSkip && (
        <button onClick={handleSkip} style={{
          position: 'absolute', top: 8, right: 8, zIndex: 3,
          background: '#0a0a0e', border: `1px solid ${MINT}66`, color: MINT,
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm)',
          cursor: 'pointer', padding: '1px 8px',
        }}>skip {'»'}</button>
      )}

      {/* "Don't show again" — checkbox at the foot of the animation */}
      <label style={{
        position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        color: `${MINT}aa`, fontFamily: "'VT323', monospace",
        fontSize: 'var(--text-sm)', cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={alwaysSkip}
          onChange={(e) => toggleAlwaysSkip(e.target.checked)}
        />
        don&apos;t show this animation again
      </label>
    </div>
  );
}
