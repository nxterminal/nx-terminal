import { useState, useEffect, useRef } from 'react';

const PROGRAMS = [
  { id: 'live-feed', icon: '\u{1F465}', label: 'Live Feed' },
  { id: 'world-chat', icon: '\u{1F310}', label: 'World Chat' },
  { id: 'leaderboard', icon: '\u{1F3C6}', label: 'Leaderboard' },
  { id: 'protocol-market', icon: '\u{1F4CA}', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '\u{1F9E0}', label: 'AI Lab' },
  { id: 'my-devs', icon: '\u{1F4C1}', label: 'My Devs' },
  { id: 'shop', icon: '\u{1F6D2}', label: 'Shop' },
  { id: 'lore', icon: '\u{1F4D6}', label: 'Lore' },
];

export default function StartMenu({ open, onClose, openWindow }) {
  const [showPrograms, setShowPrograms] = useState(false);
  const [shutdownMsg, setShutdownMsg] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setShowPrograms(false);
      setShutdownMsg(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Delay to avoid catching the click that opened the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleItemClick = (id) => {
    openWindow(id);
    onClose();
  };

  const handleShutdown = () => {
    setShutdownMsg(true);
    setTimeout(() => setShutdownMsg(false), 3000);
  };

  return (
    <div className="start-menu" ref={menuRef}>
      <div className="start-menu-sidebar">
        <span className="start-menu-sidebar-text">NX Terminal</span>
      </div>
      <div className="start-menu-content">
        {shutdownMsg ? (
          <div className="start-menu-shutdown-msg">
            It is now safe to turn off your computer.
            <br /><br />
            Just kidding. You can never leave.
          </div>
        ) : (
          <>
            <div
              className="start-menu-item start-menu-item-has-sub"
              onMouseEnter={() => setShowPrograms(true)}
            >
              <span className="start-menu-item-icon">{'\u{1F4C2}'}</span>
              <span className="start-menu-item-label">Programs</span>
              <span className="start-menu-item-arrow">{'\u25B6'}</span>

              {showPrograms && (
                <div className="start-submenu" onMouseLeave={() => setShowPrograms(false)}>
                  {PROGRAMS.map(prog => (
                    <div
                      key={prog.id}
                      className="start-menu-item"
                      onClick={() => handleItemClick(prog.id)}
                    >
                      <span className="start-menu-item-icon">{prog.icon}</span>
                      <span className="start-menu-item-label">{prog.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="start-menu-item"
              onMouseEnter={() => setShowPrograms(false)}
              onClick={() => handleItemClick('control-panel')}
            >
              <span className="start-menu-item-icon">{'\u2699'}</span>
              <span className="start-menu-item-label">Settings</span>
            </div>

            <div
              className="start-menu-item"
              onMouseEnter={() => setShowPrograms(false)}
              onClick={() => handleItemClick('lore')}
            >
              <span className="start-menu-item-icon">{'\u{1F4D6}'}</span>
              <span className="start-menu-item-label">Lore</span>
            </div>

            <div className="start-menu-divider" />

            <div
              className="start-menu-item"
              onMouseEnter={() => setShowPrograms(false)}
              onClick={handleShutdown}
            >
              <span className="start-menu-item-icon">{'\u{1F6D1}'}</span>
              <span className="start-menu-item-label">Shut Down...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
