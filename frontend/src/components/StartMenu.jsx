import { useState, useEffect, useRef } from 'react';
import { Win98Icon } from './Win98Icons';

const PROGRAMS = [
  { id: 'live-feed', label: 'Live Feed' },
  { id: 'world-chat', label: 'World Chat' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'protocol-market', label: 'Protocol Market' },
  { id: 'ai-lab', label: 'AI Lab' },
  { id: 'my-devs', label: 'My Devs' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'hire-devs', label: 'Mint/Hire Devs' },
];

const GAMES = [
  { id: 'bug-sweeper', label: 'Bug Sweeper' },
  { id: 'protocol-solitaire', label: 'Protocol Solitaire' },
];

export default function StartMenu({ open, onClose, openWindow }) {
  const [showPrograms, setShowPrograms] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [shutdownMsg, setShutdownMsg] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setShowPrograms(false);
      setShowGames(false);
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
              onMouseEnter={() => { setShowPrograms(true); setShowGames(false); }}
            >
              <span className="start-menu-item-icon"><Win98Icon id="my-devs" size={16} /></span>
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
                      <span className="start-menu-item-icon"><Win98Icon id={prog.id} size={16} /></span>
                      <span className="start-menu-item-label">{prog.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="start-menu-item start-menu-item-has-sub"
              onMouseEnter={() => { setShowGames(true); setShowPrograms(false); }}
            >
              <span className="start-menu-item-icon"><Win98Icon id="protocol-solitaire" size={16} /></span>
              <span className="start-menu-item-label">Games</span>
              <span className="start-menu-item-arrow">{'\u25B6'}</span>

              {showGames && (
                <div className="start-submenu" onMouseLeave={() => setShowGames(false)}>
                  {GAMES.map(game => (
                    <div
                      key={game.id}
                      className="start-menu-item"
                      onClick={() => handleItemClick(game.id)}
                    >
                      <span className="start-menu-item-icon"><Win98Icon id={game.id} size={16} /></span>
                      <span className="start-menu-item-label">{game.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="start-menu-divider" />

            <div
              className="start-menu-item"
              onMouseEnter={() => { setShowPrograms(false); setShowGames(false); }}
              onClick={() => handleItemClick('nx-terminal')}
            >
              <span className="start-menu-item-icon"><Win98Icon id="nx-terminal" size={16} /></span>
              <span className="start-menu-item-label">NX Terminal</span>
            </div>

            <div
              className="start-menu-item"
              onMouseEnter={() => { setShowPrograms(false); setShowGames(false); }}
              onClick={() => handleItemClick('control-panel')}
            >
              <span className="start-menu-item-icon"><Win98Icon id="control-panel" size={16} /></span>
              <span className="start-menu-item-label">Settings</span>
            </div>

            <div className="start-menu-divider" />

            <div
              className="start-menu-item"
              onMouseEnter={() => { setShowPrograms(false); setShowGames(false); }}
              onClick={handleShutdown}
            >
              <span className="start-menu-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
                  <circle cx="8" cy="8" r="6" fill="#ff0000" stroke="#000" strokeWidth="1" />
                  <rect x="6" y="3" width="4" height="6" fill="#fff" />
                  <rect x="7" y="2" width="2" height="4" fill="#ff0000" stroke="#fff" strokeWidth="0.5" />
                </svg>
              </span>
              <span className="start-menu-item-label">Shut Down...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
