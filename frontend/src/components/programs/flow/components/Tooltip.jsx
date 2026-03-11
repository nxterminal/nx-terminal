import { useState, useRef, useCallback } from 'react';

export default function Tooltip({ text, children, style }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        setPos({ x: rect.left + 8, y: rect.bottom + 4 });
      }
      setVisible(true);
    }, 400);
  }, []);

  const onLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!text) return children;

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {visible && (
        <div className="flow-tooltip" style={{ left: pos.x, top: pos.y }}>
          {text}
        </div>
      )}
    </div>
  );
}
