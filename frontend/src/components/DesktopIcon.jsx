import { useCallback } from 'react';
import { Win98Icon } from './Win98Icons';

export default function DesktopIcon({ id, icon, label, onDoubleClick, locked, title }) {
  const handleDoubleClick = useCallback(() => {
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div
      className="desktop-icon"
      onDoubleClick={handleDoubleClick}
      title={title}
      style={locked ? { opacity: 0.5, filter: 'grayscale(0.5)' } : undefined}
    >
      <div className="desktop-icon-img">
        {id ? <Win98Icon id={id} size={32} /> : icon}
      </div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
