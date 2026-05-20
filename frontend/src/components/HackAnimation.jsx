import { useState, useEffect, useRef } from 'react';

// HackAnimation — Phase 5.14. Terminal-style "hacking…" sequence shown
// while a hack request is in flight, for drama. Green-on-black, VT323,
// subtle CRT scanlines.
//
// Timing contract (see HackModal): the animation is a MINIMUM wait —
// the hack request runs in parallel. `responseReady` tells the
// animation the backend has replied. `onDone` fires exactly once, when
// BOTH the scripted sequence has finished AND the response is ready,
// OR immediately when the user hits SKIP. If the response is slower
// than the script, the last line keeps looping its dots until it
// arrives (no visible timeout).

const LINES = [
  '> INITIATING HACK SEQUENCE...',
  '> Connecting to target node...',
  '> Bypassing firewall...',
  '> Injecting payload...',
  '> Extracting data...',
];

const LINE_INTERVAL = 400;          // ms between line reveals
const HOLD_AFTER_LAST = 1200;       // ms held after the last line → ~3s total
const SKIP_DELAY = 1000;            // SKIP button appears after this
const TICK_MS = 400;                // cursor blink + waiting-dots cadence
const GREEN = '#44ffaa';

const ALWAYS_SKIP_PREFIX = 'nx:hack_animation:always_skip:';

function alwaysSkipKey(wallet) {
  return wallet ? `${ALWAYS_SKIP_PREFIX}${wallet.toLowerCase()}` : null;
}

// Read by HackModal BEFORE an execution to decide whether to skip the
// animation entirely. Exported so the modal and the component share one
// source of truth for the key format.
export function hackAnimationAlwaysSkip(wallet) {
  const key = alwaysSkipKey(wallet);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export default function HackAnimation({ responseReady, onDone, walletAddress }) {
  const [revealed, setRevealed] = useState(1);   // line 1 visible immediately
  const [scriptedDone, setScriptedDone] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [tick, setTick] = useState(0);
  const [alwaysSkip, setAlwaysSkip] = useState(() => hackAnimationAlwaysSkip(walletAddress));
  const doneFiredRef = useRef(false);

  // Scripted reveal + skip-button timers.
  useEffect(() => {
    const timers = [];
    for (let i = 1; i < LINES.length; i++) {
      timers.push(setTimeout(() => setRevealed(i + 1), i * LINE_INTERVAL));
    }
    timers.push(setTimeout(
      () => setScriptedDone(true),
      (LINES.length - 1) * LINE_INTERVAL + HOLD_AFTER_LAST,
    ));
    timers.push(setTimeout(() => setShowSkip(true), SKIP_DELAY));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Single cadence interval drives the blinking cursor + waiting dots.
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), TICK_MS);
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

  // "Don't show again" only affects the NEXT hack — never aborts the
  // current animation (per the Phase 5.14 spec).
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

  const cursorOn = tick % 2 === 0;
  const waiting = scriptedDone && !responseReady;
  const dotCount = tick % 4;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#000', overflow: 'hidden',
      fontFamily: "'VT323', monospace",
    }}>
      {/* Terminal text */}
      <div style={{
        position: 'absolute', inset: 0, padding: '28px 32px',
        color: GREEN, fontSize: 'var(--text-xl)', lineHeight: 1.7,
        textShadow: `0 0 6px ${GREEN}66`, zIndex: 1,
      }}>
        {LINES.slice(0, revealed).map((line, idx) => {
          const isLastVisible = idx === revealed - 1;
          let text = line;
          if (idx === LINES.length - 1 && waiting) {
            // Slow response — loop the last line's dots, no timeout shown.
            text = '> Extracting data' + '.'.repeat(dotCount);
          }
          return (
            <div key={idx}>
              {text}
              {isLastVisible && (
                <span style={{ opacity: cursorOn ? 1 : 0 }}>{'█'}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Subtle CRT scanlines */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'repeating-linear-gradient(to bottom,'
          + ' rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px,'
          + ' rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 3px)',
      }} />

      {/* SKIP — appears after 1s so the animation is seen at least once */}
      {showSkip && (
        <button onClick={handleSkip} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 3,
          background: '#0a0a1e', border: `1px solid ${GREEN}66`, color: GREEN,
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
          cursor: 'pointer', padding: '3px 12px',
        }}>SKIP {'»'}</button>
      )}

      {/* "Don't show again" — corner checkbox; affects only the next hack */}
      <label style={{
        position: 'absolute', bottom: 12, right: 16, zIndex: 3,
        display: 'flex', alignItems: 'center', gap: 6,
        color: `${GREEN}aa`, fontFamily: "'VT323', monospace",
        fontSize: 'var(--text-sm)', cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={alwaysSkip}
          onChange={(e) => toggleAlwaysSkip(e.target.checked)}
        />
        Don&apos;t show this animation again
      </label>
    </div>
  );
}
