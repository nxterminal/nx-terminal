import { useState, useEffect, useRef } from 'react';
import {
  IconMonitor, IconEnvelope, IconBriefcase, IconFolderPerson, IconChart,
  IconAntenna, IconCart, IconDollar, IconChartLens, IconBook, IconScroll,
  IconPerson, IconLeaderboard, IconGlobe, IconBrain, IconCard, IconFlag,
  IconComputer, IconNotepad, IconTrash, IconGear, IconFolder, IconClose,
} from './icons';

const PROGRAMS = [
  { id: 'nx-home', icon: <IconMonitor size={16} />, label: 'NX Terminal' },
  { id: 'hire-devs', icon: <IconBriefcase size={16} />, label: 'Hire Devs / Mint' },
  { id: 'my-devs', icon: <IconFolderPerson size={16} />, label: 'My Devs' },
  { id: 'action-feed', icon: <IconAntenna size={16} />, label: 'Live Feed' },
  { id: 'protocol-market', icon: <IconChart size={16} />, label: 'Protocol Market' },
  { id: 'ai-lab', icon: <IconBrain size={16} />, label: 'AI Lab' },
  { id: 'shop', icon: <IconCart size={16} />, label: 'Company Store' },
  { id: 'notepad', icon: <IconNotepad size={16} />, label: 'Notepad' },
];

const GAMES = [
  { id: 'bug-sweeper', icon: <IconFlag size={16} />, label: 'Bug Sweeper' },
  { id: 'protocol-solitaire', icon: <IconCard size={16} />, label: 'Protocol Solitaire' },
];

const DOCUMENTS = [
  { id: 'handbook', icon: <IconBook size={16} />, label: 'Employee Handbook' },
  { id: 'lore', icon: <IconScroll size={16} />, label: 'Lore' },
];

const SETTINGS = [
  { id: 'control-panel', icon: <IconGear size={16} />, label: 'Control Panel' },
  { id: 'my-account', icon: <IconPerson size={16} />, label: 'My Account' },
];

export default function StartMenu({ onOpenWindow, onCloseAll, onClose, onShutDown }) {
  const ref = useRef(null);
  const [submenu, setSubmenu] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleClick = (id) => {
    if (id === '__close_all') {
      onCloseAll();
    } else if (id === '__shut_down') {
      onShutDown?.();
    } else {
      onOpenWindow(id);
    }
    onClose();
  };

  const renderSubmenu = (items) => (
    <div className="start-submenu">
      {items.map(item => (
        <button
          key={item.id}
          className="start-menu-item"
          onClick={() => handleClick(item.id)}
        >
          <span className="start-menu-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="start-menu" ref={ref}>
      <div className="start-menu-banner">
        <span className="start-menu-banner-text">NX TERMINAL</span>
      </div>
      <div className="start-menu-items">
        <div
          className={`start-menu-item has-sub${submenu === 'programs' ? ' active' : ''}`}
          onMouseEnter={() => setSubmenu('programs')}
        >
          <span className="start-menu-icon"><IconFolder size={16} /></span>
          <span style={{ flex: 1 }}>Programs</span>
          <span className="sub-arrow">{'\u25B6'}</span>
          {submenu === 'programs' && renderSubmenu(PROGRAMS)}
        </div>

        <div
          className={`start-menu-item has-sub${submenu === 'games' ? ' active' : ''}`}
          onMouseEnter={() => setSubmenu('games')}
        >
          <span className="start-menu-icon"><IconCard size={16} /></span>
          <span style={{ flex: 1 }}>Games</span>
          <span className="sub-arrow">{'\u25B6'}</span>
          {submenu === 'games' && renderSubmenu(GAMES)}
        </div>

        <div
          className={`start-menu-item has-sub${submenu === 'documents' ? ' active' : ''}`}
          onMouseEnter={() => setSubmenu('documents')}
        >
          <span className="start-menu-icon"><IconScroll size={16} /></span>
          <span style={{ flex: 1 }}>Documents</span>
          <span className="sub-arrow">{'\u25B6'}</span>
          {submenu === 'documents' && renderSubmenu(DOCUMENTS)}
        </div>

        <div
          className={`start-menu-item has-sub${submenu === 'settings' ? ' active' : ''}`}
          onMouseEnter={() => setSubmenu('settings')}
        >
          <span className="start-menu-icon"><IconGear size={16} /></span>
          <span style={{ flex: 1 }}>Settings</span>
          <span className="sub-arrow">{'\u25B6'}</span>
          {submenu === 'settings' && renderSubmenu(SETTINGS)}
        </div>

        <div className="start-menu-item disabled" onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconChartLens size={16} /></span>
          <span style={{ color: '#888' }}>Find...</span>
        </div>

        <button className="start-menu-item" onClick={() => handleClick('world-chat')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconGlobe size={16} /></span>
          <span>World Chat</span>
        </button>

        <div className="start-menu-separator" />

        <button className="start-menu-item bold" onClick={() => handleClick('collect-salary')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconDollar size={16} /></span>
          <span>Collect Salary</span>
        </button>

        <button className="start-menu-item" onClick={() => handleClick('nxt-stats')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconChartLens size={16} /></span>
          <span>$NXT Stats</span>
        </button>

        <button className="start-menu-item" onClick={() => handleClick('inbox')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconEnvelope size={16} /></span>
          <span>Inbox</span>
        </button>

        <button className="start-menu-item" onClick={() => handleClick('leaderboard')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconLeaderboard size={16} /></span>
          <span>Rankings</span>
        </button>

        <div className="start-menu-separator" />

        <button className="start-menu-item" onClick={() => handleClick('my-computer')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconComputer size={16} /></span>
          <span>My Computer</span>
        </button>

        <button className="start-menu-item" onClick={() => handleClick('recycle-bin')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconTrash size={16} /></span>
          <span>Recycle Bin</span>
        </button>

        <div className="start-menu-separator" />

        <button className="start-menu-item" onClick={() => handleClick('__close_all')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon"><IconClose size={16} /></span>
          <span>Close All Windows</span>
        </button>

        <button className="start-menu-item" onClick={() => handleClick('__shut_down')} onMouseEnter={() => setSubmenu(null)}>
          <span className="start-menu-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="9" r="6" fill="none" stroke="#cc0000" strokeWidth="1.5"/>
              <line x1="8" y1="3" x2="8" y2="9" stroke="#cc0000" strokeWidth="2"/>
            </svg>
          </span>
          <span>Shut Down...</span>
        </button>
      </div>
    </div>
  );
}
