import { useEffect, useState, useCallback, useRef } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import NXAssistant from './NXAssistant';
import ErrorPopup from './ErrorPopup';
import BSOD from './BSOD';
import Screensaver from './Screensaver';
import { useWindowManager } from '../hooks/useWindowManager';

const DESKTOP_ICONS = [
  { id: 'nx-terminal', icon: '>_', label: 'NX Terminal' },
  { id: 'live-feed', icon: '>>', label: 'Live Feed' },
  { id: 'world-chat', icon: '#', label: 'World Chat' },
  { id: 'leaderboard', icon: '*', label: 'Leaderboard' },
  { id: 'protocol-market', icon: '$', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '~', label: 'AI Lab' },
  { id: 'my-devs', icon: '=', label: 'My Devs' },
  { id: 'nxt-wallet', icon: '$', label: 'NXT Wallet' },
  { id: 'inbox', icon: 'M', label: 'Inbox' },
  { id: 'hire-devs', icon: '+', label: 'Mint/Hire Devs' },
  { id: 'notepad', icon: 'N', label: 'Notepad' },
  { id: 'recycle-bin', icon: 'x', label: 'Recycle Bin' },
  { id: 'corp-wars', icon: '\u2694', label: 'Corp Wars' },
  { id: 'control-panel', icon: '::', label: 'Settings' },
];

function getWallpaperStyle() {
  const wp = localStorage.getItem('nx-wallpaper') || 'teal';
  const custom = localStorage.getItem('nx-custom-wallpaper');

  switch (wp) {
    case 'corporate-blue':
      return { background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)' };
    case 'matrix':
      return { background: '#000000' };
    case 'clouds':
      return { background: 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 40%, #b0d4f1 60%, #ffffff 100%)' };
    case 'terminal':
      return { background: '#000000' };
    case 'custom':
      if (custom) return { backgroundImage: `url(${custom})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      return { background: '#008080' };
    default:
      return { background: '#008080' };
  }
}

function getWallpaperOverlay() {
  const wp = localStorage.getItem('nx-wallpaper') || 'teal';
  if (wp === 'matrix') return 'matrix';
  if (wp === 'terminal') return 'scanlines';
  return null;
}

function getInitialUnreadCount() {
  const readIds = JSON.parse(localStorage.getItem('nx-inbox-read') || '[]');
  return readIds.includes('welcome-1') ? 0 : 1;
}

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

  const [wallpaperStyle, setWallpaperStyle] = useState(getWallpaperStyle);
  const [wallpaperOverlay, setWallpaperOverlay] = useState(getWallpaperOverlay);
  const [showBSOD, setShowBSOD] = useState(false);
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [unreadCount, setUnreadCount] = useState(getInitialUnreadCount);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    const handleUnread = (e) => setUnreadCount(e.detail);
    window.addEventListener('nx-inbox-unread', handleUnread);
    return () => window.removeEventListener('nx-inbox-unread', handleUnread);
  }, []);

  const refreshSettings = useCallback(() => {
    setWallpaperStyle(getWallpaperStyle());
    setWallpaperOverlay(getWallpaperOverlay());
    // Apply theme
    const theme = localStorage.getItem('nx-theme') || 'classic';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    // Apply theme on mount
    const theme = localStorage.getItem('nx-theme') || 'classic';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    window.addEventListener('nx-settings-changed', refreshSettings);
    return () => window.removeEventListener('nx-settings-changed', refreshSettings);
  }, [refreshSettings]);

  // Screensaver timeout from settings
  const [ssTimeout, setSsTimeout] = useState(() => {
    return parseInt(localStorage.getItem('nx-screensaver-timeout')) || 60000;
  });

  useEffect(() => {
    const handleChange = () => {
      setSsTimeout(parseInt(localStorage.getItem('nx-screensaver-timeout')) || 60000);
    };
    window.addEventListener('nx-screensaver-changed', handleChange);
    return () => window.removeEventListener('nx-screensaver-changed', handleChange);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (showScreensaver) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowScreensaver(true);
    }, ssTimeout);
  }, [showScreensaver, ssTimeout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // BSOD: 2% chance on window open — wrap openWindow
  const openWindowWithBSOD = useCallback((id, extraProps) => {
    if (Math.random() < 0.02) {
      setShowBSOD(true);
      return;
    }
    openWindow(id, extraProps);
  }, [openWindow]);

  const handleTaskbarClick = (id) => {
    const win = windows.find(w => w.id === id);
    if (win && !win.minimized) {
      minimizeWindow(id);
    } else {
      openWindowWithBSOD(id);
    }
  };

  return (
    <div className="desktop" style={wallpaperStyle}>
      {wallpaperOverlay === 'matrix' && <div className="wallpaper-matrix" />}
      {wallpaperOverlay === 'scanlines' && <div className="wallpaper-scanlines" />}

      <div className="desktop-icons">
        {DESKTOP_ICONS.map(item => (
          <DesktopIcon
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            onDoubleClick={() => openWindowWithBSOD(item.id)}
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

      <NXAssistant />
      <ErrorPopup />

      {showBSOD && <BSOD onDismiss={() => setShowBSOD(false)} />}
      {showScreensaver && <Screensaver onDismiss={() => setShowScreensaver(false)} />}

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        openWindow={openWindowWithBSOD}
        unreadCount={unreadCount}
      />
    </div>
  );
}
