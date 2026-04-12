import { useCallback } from 'react';
import { Win98Icon } from './Win98Icons';

export default function DesktopIcon({ id, icon, label, iconSize = 32, onDoubleClick, unreadCount = 0 }) {
  const handleDoubleClick = useCallback(() => {
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div className="desktop-icon" onDoubleClick={handleDoubleClick}>
      <div className="desktop-icon-img">
        {id ? <Win98Icon id={id} size={iconSize} /> : icon}
        {unreadCount > 0 && <span className="desktop-icon-badge" />}
      </div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
