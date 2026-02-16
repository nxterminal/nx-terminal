import { useCallback } from 'react';

export default function DesktopIcon({ icon, label, onDoubleClick }) {
  const handleDoubleClick = useCallback(() => {
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div className="desktop-icon" onDoubleClick={handleDoubleClick}>
      <div className="desktop-icon-img">{icon}</div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
