import { useRef, useCallback } from 'react';

export default function Window({
  id,
  title,
  icon,
  position,
  size,
  minimized,
  maximized,
  zIndex,
  isActive,
  onClose,
  onFocus,
  onMinimize,
  onMaximize,
  onMove,
  children,
  statusBar,
}) {
  const dragRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (maximized) return;
    onFocus();
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e) => {
      onMove({
        x: Math.max(0, e.clientX - startX),
        y: Math.max(0, e.clientY - startY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, maximized, onFocus, onMove]);

  if (minimized) return null;

  return (
    <div
      className={`win98-window${maximized ? ' maximized' : ''}`}
      style={{
        left: maximized ? undefined : position.x,
        top: maximized ? undefined : position.y,
        width: maximized ? undefined : size.width,
        height: maximized ? undefined : size.height,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      <div
        className={`win98-titlebar${isActive === false ? ' inactive' : ''}`}
        onMouseDown={handleMouseDown}
        ref={dragRef}
      >
        <span className="win98-titlebar-icon">{icon}</span>
        <span className="win98-titlebar-title">{title}</span>
        <div className="win98-titlebar-buttons">
          <button className="win98-titlebar-btn" onClick={onMinimize} title="Minimize">
            <span style={{ fontSize: '10px', marginTop: '4px' }}>_</span>
          </button>
          <button className="win98-titlebar-btn" onClick={onMaximize} title="Maximize">
            <span style={{ fontSize: '8px' }}>&#9633;</span>
          </button>
          <button className="win98-titlebar-btn" onClick={onClose} title="Close">
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>x</span>
          </button>
        </div>
      </div>
      <div className="win98-content">
        {children}
      </div>
      {statusBar && (
        <div className="win98-statusbar">{statusBar}</div>
      )}
    </div>
  );
}
