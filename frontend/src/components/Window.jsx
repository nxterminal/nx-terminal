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

  // Resize handler factory. `dir` is a compass string like 'n', 'se',
  // 'sw'… and the move handler branches on which characters appear in
  // it. North/west edges also shift the window position so the
  // opposite edge stays pinned. Min size (200×150) is enforced via the
  // resizeWindow store action plus an explicit clamp here so the X/Y
  // delta calculation doesn't overshoot. Window is held inside the
  // viewport top/left at 0,0 so it can't be dragged off-screen.
  const handleResizeStart = useCallback((dir) => (e) => {
    if (maximized || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = position.x;
    const startPosY = position.y;
    const MIN_W = 200;
    const MIN_H = 150;

    const handleResizeMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      if (dir.includes('e')) {
        newWidth = Math.max(MIN_W, startWidth + dx);
      }
      if (dir.includes('w')) {
        const proposedWidth = startWidth - dx;
        newWidth = Math.max(MIN_W, proposedWidth);
        newX = startPosX + (startWidth - newWidth);
      }
      if (dir.includes('s')) {
        newHeight = Math.max(MIN_H, startHeight + dy);
      }
      if (dir.includes('n')) {
        const proposedHeight = startHeight - dy;
        newHeight = Math.max(MIN_H, proposedHeight);
        newY = startPosY + (startHeight - newHeight);
      }

      // Pin top-left to the viewport — west/north drags can't go
      // below 0. When the new edge would cross 0, swallow the
      // overshoot into the size delta so the window keeps shrinking
      // smoothly instead of teleporting.
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
      }
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
      }

      if (newX !== startPosX || newY !== startPosY) {
        onMove({ x: newX, y: newY });
      }
      onResize({ width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      resizeListenersRef.current = null;
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    resizeListenersRef.current = { move: handleResizeMove, up: handleResizeEnd };
  }, [maximized, size, position, onFocus, onResize, onMove]);

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
        <>
          <div className="win98-resize n"  onMouseDown={handleResizeStart('n')}  />
          <div className="win98-resize s"  onMouseDown={handleResizeStart('s')}  />
          <div className="win98-resize w"  onMouseDown={handleResizeStart('w')}  />
          <div className="win98-resize e"  onMouseDown={handleResizeStart('e')}  />
          <div className="win98-resize nw" onMouseDown={handleResizeStart('nw')} />
          <div className="win98-resize ne" onMouseDown={handleResizeStart('ne')} />
          <div className="win98-resize sw" onMouseDown={handleResizeStart('sw')} />
          {/* The visible bottom-right grip stays the same Win98 dotted
              corner from before — just hooked up to the new factory. */}
          <div
            className="win98-resize-handle"
            onMouseDown={handleResizeStart('se')}
            title="Drag to resize"
          />
        </>
      )}
    </div>
  );
}
