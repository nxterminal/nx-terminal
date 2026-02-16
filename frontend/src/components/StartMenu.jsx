import { useState, useRef, useEffect } from 'react';

const MENU_ITEMS = [
  {
    label: 'Programs', icon: '📂', submenu: [
      { id: 'action-feed', label: 'Action Feed', icon: '📡' },
      { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
      { id: 'protocol-market', label: 'Protocol Market', icon: '📊' },
      { id: 'ai-lab', label: 'AI Lab', icon: '🧠' },
      { id: 'dev-chat', label: 'Dev Chat', icon: '💬' },
      { id: 'world-chat', label: 'World Chat', icon: '🌐' },
      { separator: true },
      {
        label: 'Games', icon: '🎮', submenu: [
          { id: 'bug-sweeper', label: 'Bug Sweeper', icon: '🐛' },
          { id: 'solitaire', label: 'Protocol Solitaire', icon: '🃏' },
        ]
      },
      { separator: true },
      { id: 'notepad', label: 'Notepad', icon: '📝' },
    ]
  },
  {
    label: 'NX Terminal', icon: '🖥️', submenu: [
      { id: 'nx-home', label: 'NX Home', icon: '🏠' },
      { id: 'my-devs', label: 'My Devs', icon: '📁' },
      { id: 'shop', label: 'Shop', icon: '🛒' },
      { id: 'hire-devs', label: 'Mint / Hire Devs', icon: '💼' },
      { id: 'collect-salary', label: 'Collect Salary', icon: '💰' },
      { id: 'inbox', label: 'Inbox', icon: '📬' },
      { id: 'nxt-stats', label: 'NXT Stats', icon: '📈' },
    ]
  },
  {
    label: 'Documents', icon: '📄', submenu: [
      { id: 'my-computer', label: 'Employee Handbook', icon: '📖', extraProps: { initialTab: 'handbook' } },
      { id: 'my-computer', label: 'Lore', icon: '📜', extraProps: { initialTab: 'lore' } },
    ]
  },
  {
    label: 'Settings', icon: '⚙️', submenu: [
      { id: 'control-panel', label: 'Control Panel', icon: '🔧' },
      { id: 'my-account', label: 'My Account', icon: '👤' },
    ]
  },
  { separator: true },
  { id: 'shut-down', label: 'Shut Down...', icon: '🔌' },
];

function MenuItem({ item, onAction, level = 0 }) {
  const [showSub, setShowSub] = useState(false);

  if (item.separator) {
    return <div className="start-menu-separator" />;
  }

  const hasSub = item.submenu && item.submenu.length > 0;

  const handleEnter = () => setShowSub(true);
  const handleLeave = () => setShowSub(false);

  const handleClick = () => {
    if (item.id) {
      onAction(item.id, item.extraProps);
    }
  };

  return (
    <div className="start-menu-item-wrapper" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div className={`start-menu-item${showSub && hasSub ? ' active' : ''}`} onClick={handleClick}>
        <span className="start-menu-item-icon">{item.icon}</span>
        <span className="start-menu-item-label">{item.label}</span>
        {hasSub && <span className="start-menu-item-arrow">▸</span>}
      </div>
      {hasSub && showSub && (
        <div className="start-submenu" style={{ left: '100%', top: 0 }}>
          {item.submenu.map((sub, i) => (
            <MenuItem key={sub.id || `sep-${i}`} item={sub} onAction={onAction} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StartMenu({ open, onClose, openWindow }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const handleAction = (id, extraProps) => {
    if (id === 'shut-down') {
      onClose();
      return;
    }
    openWindow(id, extraProps);
    onClose();
  };

  return (
    <div className="start-menu" ref={ref}>
      <div className="start-menu-banner">
        <span className="start-menu-banner-text">NX Terminal</span>
      </div>
      <div className="start-menu-items">
        {MENU_ITEMS.map((item, i) => (
          <MenuItem key={item.id || item.label || `sep-${i}`} item={item} onAction={handleAction} />
        ))}
      </div>
    </div>
  );
}
