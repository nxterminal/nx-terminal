import { useState, useEffect, useRef } from 'react';

export default function Screensaver() {
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);
  const [pos, setPos] = useState({ x: 50, y: 50, dx: 1.5, dy: 1 });

  useEffect(() => {
    const resetTimer = () => {
      clearTimeout(timerRef.current);
      if (active) {
        setActive(false);
        return;
      }
      timerRef.current = setTimeout(() => {
        setActive(true);
      }, 120000); // 2 minutes
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setPos(p => {
        let { x, y, dx, dy } = p;
        x += dx;
        y += dy;
        if (x <= 0 || x >= 85) dx = -dx;
        if (y <= 0 || y >= 85) dy = -dy;
        return { x, y, dx, dy };
      });
    }, 50);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="screensaver" onClick={() => setActive(false)} onMouseMove={() => setActive(false)}>
      <div className="screensaver-text" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px', color: 'var(--terminal-green)', textShadow: '0 0 10px var(--terminal-green)' }}>
          NX TERMINAL
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--terminal-amber)', marginTop: '4px' }}>
          Protocol Wars
        </div>
      </div>
      {/* Floating stars */}
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} className="screensaver-star" style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${1 + Math.random() * 2}s`,
        }} />
      ))}
    </div>
  );
}
