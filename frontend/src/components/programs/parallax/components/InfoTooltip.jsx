import { useState, useRef, useCallback } from 'react';

export default function InfoTooltip({ title, text, children, style }) {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      // Check if tooltip fits above
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setAbove(rect.top > 100);
      }
      setVisible(true);
    }, 300);
  }, []);

  const onLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', ...style }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {visible && (
        <div
          className="plx-info-tooltip"
          style={above ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }}
        >
          {title && <div className="plx-info-tooltip-title">{title}</div>}
          <div className="plx-info-tooltip-text">{text}</div>
        </div>
      )}
    </div>
  );
}
