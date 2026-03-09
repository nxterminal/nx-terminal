import { useState, useRef, useCallback } from 'react';

export default function InfoTooltip({ text, children, style }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const onLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div
      style={{ position: 'relative', ...style }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {visible && (
        <div className="plx-tooltip">{text}</div>
      )}
    </div>
  );
}
