import { useEffect } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import { useWindowManager } from '../hooks/useWindowManager';

const DESKTOP_ICONS = [
  { id: 'mint-devs', icon: '\u26A1', label: 'Mint Devs' },
  { id: 'action-feed', icon: '\u{1F4E1}', label: 'Action Feed' },
  { id: 'leaderboard', icon: '\u{1F3C6}', label: 'Leaderboard' },
  { id: 'protocol-market', icon: '\u{1F4CA}', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '\u{1F9E0}', label: 'AI Lab' },
  { id: 'dev-chat', icon: '\u{1F4AC}', label: 'Dev Chat' },
  { id: 'world-chat', icon: '\u{1F310}', label: 'World Chat' },
  { id: 'my-devs', icon: '\u{1F4C1}', label: 'My Devs' },
  { id: 'shop', icon: '\u{1F6D2}', label: 'Shop' },
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

  useEffect(() => {
    openWindow('action-feed');
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
      />

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        onOpenWindow={openWindow}
      />
    </div>
  );
}
