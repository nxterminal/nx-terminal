import { useEffect, useRef } from 'react';

export default function PetMenu({ position, onClose, onFeed, onPet, onStatus, onHelper, onDismiss, helperMode }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Delay to avoid the same right-click closing the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const items = [
    { label: 'Feed', action: () => { onFeed(); onClose(); } },
    { label: 'Pet', action: () => { onPet(); onClose(); } },
    { divider: true },
    { label: 'Status', action: () => { onStatus(); onClose(); } },
    { label: `Helper ${helperMode ? '[ON]' : '[OFF]'}`, action: () => { onHelper(); onClose(); } },
    { divider: true },
    { label: 'Dismiss', action: () => { onDismiss(); onClose(); } },
  ];

  return (
    <div
      ref={menuRef}
      className="cp-menu"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9998,
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="cp-menu-divider" />
        ) : (
          <div
            key={i}
            className="cp-menu-item"
            onClick={item.action}
          >
            {item.label}
          </div>
        )
      )}
    </div>
  );
}
