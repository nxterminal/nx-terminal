import { useEffect, useState } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import StartMenu from './StartMenu';
import Clippy from './Clippy';
import ErrorPopup from './ErrorPopup';
import BSOD from './BSOD';
import Screensaver from './Screensaver';
import { useWindowManager } from '../hooks/useWindowManager';
import { useInbox } from '../contexts/InboxContext';

const DESKTOP_ICONS = [
  { id: 'my-computer', icon: '🖥️', label: 'My Computer' },
  { id: 'recycle-bin', icon: '🗑️', label: 'Recycle Bin' },
  { id: 'nx-home', icon: '🏠', label: 'NX Home' },
  { id: 'inbox', icon: '📬', label: 'Inbox' },
  { id: 'action-feed', icon: '📡', label: 'Action Feed' },
  { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
  { id: 'protocol-market', icon: '📊', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '🧠', label: 'AI Lab' },
  { id: 'dev-chat', icon: '💬', label: 'Dev Chat' },
  { id: 'world-chat', icon: '🌐', label: 'World Chat' },
  { id: 'my-devs', icon: '📁', label: 'My Devs' },
  { id: 'shop', icon: '🛒', label: 'Shop' },
  { id: 'hire-devs', icon: '💼', label: 'Mint / Hire Devs' },
  { id: 'collect-salary', icon: '💰', label: 'Collect Salary' },
  { id: 'nxt-stats', icon: '📈', label: 'NXT Stats' },
  { id: 'notepad', icon: '📝', label: 'Notepad' },
  { id: 'bug-sweeper', icon: '🐛', label: 'Bug Sweeper' },
  { id: 'solitaire', icon: '🃏', label: 'Solitaire' },
];

export default function Desktop() {
  const {
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    openDevProfile,
  } = useWindowManager();

  const { addEmail } = useInbox();
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    openWindow('action-feed');
  }, []);

  // Welcome email 2 seconds after mount
  useEffect(() => {
    const t = setTimeout(() => {
      addEmail({
        from: 'admin@nxterminal.io',
        subject: 'Welcome to NX Terminal!',
        body: 'Welcome, Operator.\n\nYou have been granted Level 1 clearance to the NX Terminal network. Your assigned devs are standing by.\n\nRemember:\n- Collect your salary regularly\n- Monitor the Action Feed for opportunities\n- Keep your devs energized\n\nGood luck out there.\n\n\u2014 NX Terminal Admin',
      });
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const handleTaskbarClick = (id) => {
    const win = windows.find(w => w.id === id);
    if (win && !win.minimized) {
      minimizeWindow(id);
    } else {
      openWindow(id);
    }
  };

  return (
    <div className="desktop">
      <div className="desktop-icons">
        {DESKTOP_ICONS.map(item => (
          <DesktopIcon
            key={item.id}
            icon={item.icon}
            label={item.label}
            onDoubleClick={() => openWindow(item.id)}
          />
        ))}
      </div>

      <WindowManager
        windows={windows}
        closeWindow={closeWindow}
        focusWindow={focusWindow}
        minimizeWindow={minimizeWindow}
        maximizeWindow={maximizeWindow}
        moveWindow={moveWindow}
        openDevProfile={openDevProfile}
        openWindow={openWindow}
      />

      <StartMenu
        open={startOpen}
        onClose={() => setStartOpen(false)}
        openWindow={openWindow}
      />

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        onStartClick={() => setStartOpen(s => !s)}
        startOpen={startOpen}
        openWindow={openWindow}
      />

      <Clippy />
      <ErrorPopup />
      <BSOD />
      <Screensaver />
    </div>
  );
}
