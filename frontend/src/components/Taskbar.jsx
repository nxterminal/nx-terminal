import { useState, useEffect } from 'react';
import { api } from '../services/api';
import StartMenu from './StartMenu';
import { WINDOW_ICONS } from './WindowManager';
import { IconStart, IconWallet, IconMail16 } from './icons';

export default function Taskbar({
  windows,
  onWindowClick,
  onOpenWindow,
  onCloseAll,
  wallet,
  onWalletClick,
  hasUnread,
  onInboxClick,
  onShutDown,
}) {
  const [cycle, setCycle] = useState(null);
  const [clock, setClock] = useState('');
  const [showStartMenu, setShowStartMenu] = useState(false);

  useEffect(() => {
    const fetchCycle = () => {
      api.getSimulationState()
        .then(data => setCycle(data.current_cycle || data.cycle || '?'))
        .catch(() => {});
    };
    fetchCycle();
    const id = setInterval(fetchCycle, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateClock();
    const id = setInterval(updateClock, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {showStartMenu && (
        <StartMenu
          onOpenWindow={(id) => { onOpenWindow(id); setShowStartMenu(false); }}
          onCloseAll={() => { onCloseAll(); setShowStartMenu(false); }}
          onClose={() => setShowStartMenu(false)}
          onShutDown={onShutDown}
        />
      )}
      <div className="taskbar">
        <button
          className="win-btn start-btn"
          onClick={() => setShowStartMenu(s => !s)}
          style={showStartMenu ? {
            boxShadow: 'inset 1px 1px 0 var(--border-darker), inset -1px -1px 0 var(--border-light), inset 2px 2px 0 var(--border-dark)',
            background: '#d4d0c8',
          } : undefined}
        >
          <IconStart size={14} />
          <span>Start</span>
        </button>

        <button
          className="win-btn"
          onClick={onWalletClick}
          style={{
            height: 24,
            padding: '2px 8px',
            fontSize: '10px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <IconWallet size={14} />
          <span>{wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Connect'}</span>
        </button>

        <div className="taskbar-windows">
          {windows.map(w => (
            <button
              key={w.id}
              className={`win-btn taskbar-btn${!w.minimized ? ' active' : ''}`}
              onClick={() => onWindowClick(w.id)}
              title={w.title}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {WINDOW_ICONS[w.id] || null}
                {w.title}
              </span>
            </button>
          ))}
        </div>

        <div className="tray-area">
          <span
            className="tray-icon"
            onClick={onInboxClick}
            title="Inbox"
          >
            <IconMail16 size={14} />
            {hasUnread && <span className="unread-dot" />}
          </span>
          <span style={{ fontSize: '11px', color: '#333' }}>
            C:{cycle ?? '?'}
          </span>
          <span style={{ fontSize: '11px' }}>{clock}</span>
        </div>
      </div>
    </>
  );
}
