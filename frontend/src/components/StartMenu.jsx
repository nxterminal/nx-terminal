import { useEffect, useRef } from 'react';

const MENU_ITEMS = [
  { id: 'nx-home', icon: '\u{1F5A5}', label: 'NX Terminal', bold: true },
  { id: 'inbox', icon: '\u2709', label: 'Inbox' },
  { id: 'hire-devs', icon: '\u{1F4DB}', label: 'Hire Devs', bold: true },
  { type: 'separator' },
  { id: 'my-devs', icon: '\u{1F4C1}', label: 'My Devs' },
  { id: 'my-account', icon: '\u{1F464}', label: 'My Account' },
  { id: 'collect-salary', icon: '\u{1F4B0}', label: 'Collect Salary' },
  { type: 'separator' },
  { id: 'protocol-market', icon: '\u{1F4CA}', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '\u{1F9E0}', label: 'AI Lab' },
  { id: 'action-feed', icon: '\u{1F4E1}', label: 'Live Feed' },
  { id: 'world-chat', icon: '\u{1F310}', label: 'World Chat' },
  { type: 'separator' },
  { id: 'shop', icon: '\u{1F6D2}', label: 'Company Store' },
  { id: 'nxt-stats', icon: '\u{1F4C8}', label: '$NXT Stats' },
  { id: 'leaderboard', icon: '\u{1F3C6}', label: 'Rankings' },
  { id: 'lore', icon: '\u{1F4DC}', label: 'Lore' },
  { id: 'handbook', icon: '\u{1F4D6}', label: 'Employee Handbook' },
  { type: 'separator' },
  { id: '__close_all', icon: '\u274C', label: 'Close All Windows' },
];

export default function StartMenu({ onOpenWindow, onCloseAll, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleClick = (item) => {
    if (item.id === '__close_all') {
      onCloseAll();
    } else {
      onOpenWindow(item.id);
    }
    onClose();
  };

  return (
    <div className="start-menu" ref={ref}>
      <div className="start-menu-banner">
        <span className="start-menu-banner-text">NX TERMINAL</span>
      </div>
      <div className="start-menu-items">
        {MENU_ITEMS.map((item, i) =>
          item.type === 'separator' ? (
            <div key={`sep-${i}`} className="start-menu-separator" />
          ) : (
            <button
              key={item.id}
              className={`start-menu-item${item.bold ? ' bold' : ''}`}
              onClick={() => handleClick(item)}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
