import { useState, useEffect, useCallback } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import WalletModal from './WalletModal';
import TickerBar from './TickerBar';
import NotificationBalloon from './NotificationBalloon';
import DialUpModal from './DialUpModal';
import { useWindowManager } from '../hooks/useWindowManager';

const DESKTOP_ICONS = [
  { id: 'nx-home', icon: '\u{1F5A5}', label: 'NX Terminal' },
  { id: 'inbox', icon: '\u2709', label: 'Inbox' },
  { id: 'hire-devs', icon: '\u{1F4DB}', label: 'Hire Devs' },
  { id: 'my-devs', icon: '\u{1F4C1}', label: 'My Devs' },
  { id: 'protocol-market', icon: '\u{1F4CA}', label: 'Market' },
  { id: 'ai-lab', icon: '\u{1F9E0}', label: 'AI Lab' },
  { id: 'action-feed', icon: '\u{1F4E1}', label: 'Live Feed' },
  { id: 'world-chat', icon: '\u{1F310}', label: 'World Chat' },
];

export default function Desktop() {
  const {
    windows,
    openWindow,
    closeWindow,
    closeAllWindows,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    openDevProfile,
  } = useWindowManager();

  const [wallet, setWallet] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [showBalloon, setShowBalloon] = useState(true);
  const [dialUp, setDialUp] = useState(null);

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

  const handleWalletConnect = (provider) => {
    setWallet('0x7f3a9B4c2E8d1F6a3C5b7D9e0A4f2d1b');
    setShowWalletModal(false);
  };

  const handleInboxClick = useCallback(() => {
    openWindow('inbox');
    setHasUnread(false);
    setShowBalloon(false);
  }, [openWindow]);

  const handleBalloonOpen = useCallback(() => {
    openWindow('inbox');
    setHasUnread(false);
    setShowBalloon(false);
  }, [openWindow]);

  const handleStartDialUp = useCallback((devCount, corp) => {
    setDialUp({ devCount, corp });
  }, []);

  const handleDialUpComplete = useCallback(() => {
    setDialUp(null);
    openWindow('my-devs');
  }, [openWindow]);

  return (
    <div className="desktop">
      <div className="desktop-icons">
        {DESKTOP_ICONS.map(item => (
          <DesktopIcon
            key={item.id}
            icon={item.icon}
            label={item.label}
            badge={item.id === 'inbox' && hasUnread ? '1' : null}
            onDoubleClick={() => {
              openWindow(item.id);
              if (item.id === 'inbox') setHasUnread(false);
            }}
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
        openWindow={openWindow}
        openDevProfile={openDevProfile}
        wallet={wallet}
        onStartDialUp={handleStartDialUp}
      />

      {windows.length > 0 && <TickerBar />}

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        onOpenWindow={openWindow}
        onCloseAll={closeAllWindows}
        wallet={wallet}
        onWalletClick={() => setShowWalletModal(true)}
        hasUnread={hasUnread}
        onInboxClick={handleInboxClick}
      />

      {showBalloon && (
        <NotificationBalloon
          onOpen={handleBalloonOpen}
          onDismiss={() => setShowBalloon(false)}
        />
      )}

      {showWalletModal && (
        <WalletModal
          onClose={() => setShowWalletModal(false)}
          onConnect={handleWalletConnect}
        />
      )}

      {dialUp && (
        <DialUpModal
          devCount={dialUp.devCount}
          corp={dialUp.corp}
          onComplete={handleDialUpComplete}
          onCancel={() => setDialUp(null)}
        />
      )}
    </div>
  );
}
