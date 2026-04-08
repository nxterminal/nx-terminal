import { useEffect, useState, useCallback, useRef } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import NXAssistant from './NXAssistant';
import ErrorPopup from './ErrorPopup';
import BSOD from './BSOD';
import Screensaver from './Screensaver';
import { useWindowManager } from '../hooks/useWindowManager';
import { useDevCount } from '../hooks/useDevCount';

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
  { id: 'flow', icon: '\u25C6', label: 'Flow', hidden: true },
  { id: 'nadwatch', icon: '\u{1F441}', label: 'Nadwatch', hidden: true },
  { id: 'parallax', icon: '\u{2263}', label: 'Parallax', hidden: true },
  { id: 'monad-city', icon: '', label: 'Mega City' },
  { id: 'dev-academy', icon: 'DA', label: 'NX Dev Academy' },
  { id: 'monad-build', icon: '\u26A1', label: 'Mega Build' },
  { id: 'netwatch', icon: '', label: 'MegaWatch' },
  { id: 'mega-sentinel', icon: '\u{1F6E1}', label: 'Mega Sentinel' },
  { id: 'mission-control', icon: '\u{1F4CB}', label: 'Mission Control' },
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
  const saved = localStorage.getItem('nx-inbox-emails');
  if (saved) {
    try { return JSON.parse(saved).filter(e => !e.read).length; } catch {}
  }
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

  const { devCount, tier, nextTier } = useDevCount();

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

  // Use refs so the idle listener doesn't need to be re-added on state changes
  const ssTimeoutRef = useRef(ssTimeout);
  const showScreensaverRef = useRef(showScreensaver);
  useEffect(() => { ssTimeoutRef.current = ssTimeout; }, [ssTimeout]);
  useEffect(() => { showScreensaverRef.current = showScreensaver; }, [showScreensaver]);

  const resetIdleTimer = useCallback(() => {
    if (showScreensaverRef.current) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowScreensaver(true);
    }, ssTimeoutRef.current);
  }, []);

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
        {DESKTOP_ICONS.filter(item => !item.hidden).map(item => (
          <DesktopIcon
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            onDoubleClick={() => openWindowWithBSOD(item.id)}
          />
        ))}
      </div>

      {/* Tier badge — fixed top-right corner */}
      {tier && devCount > 0 && (
        <div style={{
          position: 'fixed', top: 8, right: 8, zIndex: 5,
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '3px', padding: '4px 10px',
          fontSize: '11px', fontFamily: "'VT323', monospace",
          color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '6px',
          pointerEvents: 'none', userSelect: 'none',
        }}>
          <span>{tier.icon}</span>
          <span style={{ fontWeight: 'bold' }}>{tier.label.toUpperCase()}</span>
          <span style={{ color: '#aaa' }}>({devCount} devs)</span>
          {nextTier && (
            <span style={{ color: '#888', fontSize: '10px' }}>
              → {nextTier.label} at {nextTier.minDevs}
            </span>
          )}
        </div>
      )}

      <WindowManager
        windows={windows}
        closeWindow={closeWindow}
        focusWindow={focusWindow}
        minimizeWindow={minimizeWindow}
        maximizeWindow={maximizeWindow}
        moveWindow={moveWindow}
        openDevProfile={openDevProfile}
        openWindow={openWindowWithBSOD}
      />

      <NXAssistant />
      <ErrorPopup />

      {showBSOD && <BSOD onDismiss={() => setShowBSOD(false)} />}
      {showScreensaver && <Screensaver onDismiss={() => { setShowScreensaver(false); showScreensaverRef.current = false; resetIdleTimer(); }} />}

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        openWindow={openWindowWithBSOD}
        unreadCount={unreadCount}
      />
    </div>
  );
}
