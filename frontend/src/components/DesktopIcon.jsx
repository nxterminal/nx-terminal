import { useCallback } from 'react';
import { Win98Icon } from './Win98Icons';

export default function DesktopIcon({ id, icon, label, onDoubleClick }) {
  const handleDoubleClick = useCallback(() => {
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div className="desktop-icon" onDoubleClick={handleDoubleClick}>
      <div className="desktop-icon-img">
        {id ? <Win98Icon id={id} size={32} /> : icon}
      </div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
