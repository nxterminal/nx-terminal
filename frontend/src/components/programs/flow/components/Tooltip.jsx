import { useState, useRef, useCallback } from 'react';

export default function Tooltip({ text, children, style }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const onLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!text) return children;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {visible && (
        <div className="flow-tooltip">{text}</div>
      )}
    </div>
  );
}
