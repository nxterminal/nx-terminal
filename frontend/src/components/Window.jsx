import { useRef, useCallback, useEffect } from 'react';

export default function Window({
  id,
  title,
  icon,
  position,
  size,
  minimized,
  maximized,
  zIndex,
  onClose,
  onFocus,
  onMinimize,
  onMaximize,
  onMove,
  onResize,
  children,
  statusBar,
}) {
  const dragRef = useRef(null);
  const dragListenersRef = useRef(null);
  const resizeListenersRef = useRef(null);

  // Cleanup drag + resize listeners if component unmounts mid-interaction
  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        document.removeEventListener('mousemove', dragListenersRef.current.move);
        document.removeEventListener('mouseup', dragListenersRef.current.up);
        dragListenersRef.current = null;
      }
      if (resizeListenersRef.current) {
        document.removeEventListener('mousemove', resizeListenersRef.current.move);
        document.removeEventListener('mouseup', resizeListenersRef.current.up);
        resizeListenersRef.current = null;
      }
    };
  }, []);

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
      dragListenersRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    dragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
  }, [position, maximized, onFocus, onMove]);

  const handleResizeStart = useCallback((e) => {
    if (maximized || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleResizeMove = (ev) => {
      onResize({
        width: startWidth + (ev.clientX - startX),
        height: startHeight + (ev.clientY - startY),
      });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      resizeListenersRef.current = null;
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    resizeListenersRef.current = { move: handleResizeMove, up: handleResizeEnd };
  }, [maximized, size, onFocus, onResize]);

  if (minimized) return null;

  return (
    <div
      className={`win98-window${maximized ? ' maximized' : ''}`}
      data-window-id={id}
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
        className="win98-titlebar"
        onMouseDown={handleMouseDown}
        ref={dragRef}
      >
        <span className="win98-titlebar-icon">{icon}</span>
        <span className="win98-titlebar-title">{title}</span>
        <div className="win98-titlebar-buttons">
          <button className="win98-titlebar-btn" onClick={onMinimize} title="Minimize">
            <span style={{ fontSize: '14px', lineHeight: 1 }}>&#8722;</span>
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
      {!maximized && onResize && (
        <div
          className="win98-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );
}
