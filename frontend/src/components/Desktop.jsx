import { useState, useEffect, useCallback, useRef } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import WalletModal from './WalletModal';
import TickerBar from './TickerBar';
import NotificationBalloon from './NotificationBalloon';
import DialUpModal from './DialUpModal';
import BSOD from './BSOD';
import NXAssistant from './NXAssistant';
import Screensaver from './Screensaver';
import ErrorPopup from './ErrorPopup';
import {
  IconMonitor, IconEnvelope, IconBriefcase, IconFolderPerson, IconChart,
  IconAntenna, IconComputer, IconNotepad, IconTrash, IconCard, IconFlag,
} from './icons';
import { useWindowManager } from '../hooks/useWindowManager';

const DESKTOP_ICONS = [
  { id: 'nx-home', icon: <IconMonitor size={32} />, label: 'NX Terminal' },
  { id: 'inbox', icon: <IconEnvelope size={32} />, label: 'Inbox' },
  { id: 'hire-devs', icon: <IconBriefcase size={32} />, label: 'Hire Devs' },
  { id: 'my-devs', icon: <IconFolderPerson size={32} />, label: 'My Devs' },
  { id: 'protocol-market', icon: <IconChart size={32} />, label: 'Market' },
  { id: 'action-feed', icon: <IconAntenna size={32} />, label: 'Live Feed' },
  { id: 'bug-sweeper', icon: <IconFlag size={32} />, label: 'Bug Sweeper' },
  { id: 'protocol-solitaire', icon: <IconCard size={32} />, label: 'Solitaire' },
  { id: 'my-computer', icon: <IconComputer size={32} />, label: 'My Computer' },
  { id: 'notepad', icon: <IconNotepad size={32} />, label: 'Notepad' },
  { id: 'recycle-bin', icon: <IconTrash size={32} />, label: 'Recycle Bin' },
];

const ERROR_MESSAGES = [
  'nxprotocol.dll has performed an illegal operation and will be shut down.',
  'Warning: Your dev\'s mass-produced code has exceeded memory limits.',
  'Error: salary.exe is not responding. Try collecting later.',
  'NXTERM caused a General Protection Fault in module PROTOCOL.DLL',
  'Not enough memory to display this error message.',
  'The operation completed successfully. (Error code: 0x4E58)',
  'An error occurred while displaying the previous error.',
  'This program has performed an illegal operation. HR has been notified.',
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
  const [hasMinted, setHasMinted] = useState(false);

  // Ambient systems state
  const [showBsod, setShowBsod] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [errorPopup, setErrorPopup] = useState(null);
  const [emails, setEmails] = useState([]);

  // Timers
  const idleRef = useRef(0);
  const assistantTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    openWindow('action-feed');
  }, []);

  // Idle detection for screensaver (60s)
  useEffect(() => {
    const resetIdle = () => {
      idleRef.current = Date.now();
      if (screensaverActive) setScreensaverActive(false);
    };
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('mousedown', resetIdle);
    idleRef.current = Date.now();

    const checker = setInterval(() => {
      if (Date.now() - idleRef.current > 60000 && !screensaverActive && !showBsod) {
        setScreensaverActive(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('mousedown', resetIdle);
      clearInterval(checker);
    };
  }, [screensaverActive, showBsod]);

  // NX Assistant timer (random 2-4 min)
  useEffect(() => {
    const scheduleAssistant = () => {
      const delay = 120000 + Math.random() * 120000; // 2-4 min
      assistantTimerRef.current = setTimeout(() => {
        if (!showBsod && !screensaverActive) {
          setShowAssistant(true);
        }
        scheduleAssistant();
      }, delay);
    };
    scheduleAssistant();
    return () => clearTimeout(assistantTimerRef.current);
  }, [showBsod, screensaverActive]);

  // Error popup timer (every 3-5 min, 30% chance)
  useEffect(() => {
    const scheduleError = () => {
      const delay = 180000 + Math.random() * 120000; // 3-5 min
      errorTimerRef.current = setTimeout(() => {
        if (!showBsod && !screensaverActive && Math.random() < 0.3) {
          setErrorPopup(ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]);
        }
        scheduleError();
      }, delay);
    };
    scheduleError();
    return () => clearTimeout(errorTimerRef.current);
  }, [showBsod, screensaverActive]);

  // Wrap openWindow to add 2% BSOD chance
  const handleOpenWindow = useCallback((id, extra) => {
    if (Math.random() < 0.02 && !showBsod) {
      setShowBsod(true);
      return;
    }
    openWindow(id, extra);
  }, [openWindow, showBsod]);

  const addEmail = useCallback((email) => {
    setEmails(prev => [email, ...prev]);
    setHasUnread(true);
  }, []);

  const handleBsodDismiss = useCallback(() => {
    setShowBsod(false);
    addEmail({
      from: 'IT Department',
      subject: 'RE: System Crash Report',
      date: 'Just now',
      unread: true,
      body: 'We noticed your terminal crashed. This is normal. Please do not file a ticket.\n\nThe crash was caused by too many protocols running simultaneously. We recommend hiring fewer developers.\n\nIf the problem persists, try turning it off and on again.',
      signature: '\u2014 IT Bot v2.1',
    });
  }, [addEmail]);

  const handleAssistantFire = useCallback(() => {
    setShowAssistant(false);
    addEmail({
      from: 'HR Department',
      subject: 'RE: Termination Request \u2014 NX Assistant',
      date: 'Just now',
      unread: true,
      body: 'We received your request to terminate the NX Assistant.\n\nAfter careful review, we have decided to deny your request. The NX Assistant is a core part of the NX Terminal experience and cannot be removed.\n\nHowever, we have noted your feedback and will pass it along to the assistant\'s development team (which is also the assistant).',
      signature: '\u2014 HR Bot v3.2',
    });
  }, [addEmail]);

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
    setHasMinted(true);
    openWindow('my-devs');
    addEmail({
      from: 'HR Department',
      subject: 'RE: Your First Hire \u2014 Welcome to the team!',
      date: 'Just now',
      unread: true,
      body: 'Congratulations on hiring your first dev team!\n\nYour developers are now hard at work coding protocols, trading tokens, and shitposting in the trollbox. You just sit back and collect the profits.\n\nRemember: a happy dev is a productive dev. An unhappy dev is also a productive dev, because they have no choice.',
      signature: '\u2014 HR Bot v3.2',
    });
  }, [openWindow, addEmail]);

  const handleShutDown = useCallback(() => {
    setShowBsod(true);
  }, []);

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
              handleOpenWindow(item.id);
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
        openWindow={handleOpenWindow}
        openDevProfile={openDevProfile}
        wallet={wallet}
        onStartDialUp={handleStartDialUp}
        hasMinted={hasMinted}
        addEmail={addEmail}
      />

      {windows.length > 0 && <TickerBar />}

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        onOpenWindow={handleOpenWindow}
        onCloseAll={closeAllWindows}
        wallet={wallet}
        onWalletClick={() => setShowWalletModal(true)}
        hasUnread={hasUnread}
        onInboxClick={handleInboxClick}
        onShutDown={handleShutDown}
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

      {/* Ambient Systems */}
      {showBsod && <BSOD onDismiss={handleBsodDismiss} />}

      {showAssistant && (
        <NXAssistant
          onDismiss={() => setShowAssistant(false)}
          onFire={handleAssistantFire}
        />
      )}

      <Screensaver
        active={screensaverActive}
        onDeactivate={() => setScreensaverActive(false)}
      />

      {errorPopup && (
        <ErrorPopup
          message={errorPopup}
          onClose={() => setErrorPopup(null)}
        />
      )}
    </div>
  );
}
