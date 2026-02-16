import { useState, useEffect, useRef } from 'react';

const EASTER_EGGS = [
  'Detecting employee morale... NOT FOUND',
  'Loading corporate_propaganda.dll... OK',
];

export default function BootScreen({ onComplete }) {
  const [phase, setPhase] = useState('bios');
  const [biosLines, setBiosLines] = useState([]);
  const [memoryK, setMemoryK] = useState(0);
  const skippedRef = useRef(false);

  /* ── Skip handler: click or any key at any phase ── */
  useEffect(() => {
    const handleSkip = () => {
      if (skippedRef.current) return;
      skippedRef.current = true;
      onComplete();
    };
    window.addEventListener('keydown', handleSkip);
    window.addEventListener('click', handleSkip);
    return () => {
      window.removeEventListener('keydown', handleSkip);
      window.removeEventListener('click', handleSkip);
    };
  }, [onComplete]);

  /* ── Phase 1: BIOS POST (~1.5s) ── */
  useEffect(() => {
    if (phase !== 'bios') return;

    const timers = [];

    // Line 1: BIOS header (immediate)
    setBiosLines(['NX-BIOS v4.86 (C) 1998 NX Terminal Corp.', '']);

    // Line 2: Memory test starts at 300ms
    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setBiosLines(prev => [...prev.filter(l => l !== ''), '__MEMORY__']);
      let mem = 0;
      const memTimer = setInterval(() => {
        if (skippedRef.current) { clearInterval(memTimer); return; }
        mem += 64;
        if (mem >= 640) {
          setMemoryK(640);
          clearInterval(memTimer);
        } else {
          setMemoryK(mem);
        }
      }, 50);
      timers.push(memTimer);
    }, 300));

    // Line 3: Modem detect at 1000ms
    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setBiosLines(prev => [...prev, 'Detecting NX Modem... 56.6K [OK]']);
    }, 1000));

    // Easter egg at 1200ms (5% chance)
    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      if (Math.random() < 0.05) {
        const egg = EASTER_EGGS[Math.floor(Math.random() * EASTER_EGGS.length)];
        setBiosLines(prev => [...prev, egg]);
      }
    }, 1200));

    // Transition to splash at 1500ms
    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setPhase('splash');
    }, 1500));

    return () => timers.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [phase]);

  /* ── Phase 2: Splash (~2s) ── */
  useEffect(() => {
    if (phase !== 'splash') return;
    const timer = setTimeout(() => {
      if (skippedRef.current) return;
      setPhase('crt');
    }, 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  /* ── Phase 3: CRT transition (~1s) ── */
  useEffect(() => {
    if (phase !== 'crt') return;
    const timer = setTimeout(() => {
      if (skippedRef.current) return;
      skippedRef.current = true;
      onComplete();
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  /* ── Render ── */
  return (
    <>
      {phase === 'bios' && (
        <div className="boot-overlay boot-bios">
          {biosLines.map((line, i) => (
            <div key={i} className="bios-line">
              {line === '__MEMORY__'
                ? `Memory Test: ${memoryK >= 640 ? '640K OK' : memoryK + 'K'}`
                : line}
            </div>
          ))}
          <span className="bios-cursor">_</span>
        </div>
      )}

      {phase === 'splash' && (
        <div className="boot-overlay boot-splash">
          <div className="boot-splash-title">NX TERMINAL</div>
          <div className="boot-splash-subtitle">PROTOCOL WARS</div>
          <div className="boot-splash-tagline">
            35,000 developers. 6 corporations. No exit command.
          </div>
        </div>
      )}

      {phase === 'crt' && (
        <div className="boot-overlay boot-crt-transition">
          <div className="crt-top" />
          <div className="crt-line" />
          <div className="crt-bottom" />
        </div>
      )}
    </>
  );
}
