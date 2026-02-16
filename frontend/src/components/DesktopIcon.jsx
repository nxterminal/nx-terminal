import { useCallback } from 'react';

export default function DesktopIcon({ icon, label, badge, onDoubleClick }) {
  const handleDoubleClick = useCallback(() => {
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div className="desktop-icon" onDoubleClick={handleDoubleClick}>
      <div className="desktop-icon-wrapper">
        <div className="desktop-icon-img">{icon}</div>
        {badge && <span className="icon-badge">{badge}</span>}
      </div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
