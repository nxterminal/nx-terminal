import { useEffect, useState, useCallback } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import NXAssistant from './NXAssistant';
import { useWindowManager } from '../hooks/useWindowManager';

const DESKTOP_ICONS = [
  { id: 'live-feed', icon: '\u{1F465}', label: 'Live Feed' },
  { id: 'world-chat', icon: '\u{1F310}', label: 'World Chat' },
  { id: 'leaderboard', icon: '\u{1F3C6}', label: 'Leaderboard' },
  { id: 'protocol-market', icon: '\u{1F4CA}', label: 'Protocol Market' },
  { id: 'ai-lab', icon: '\u{1F9E0}', label: 'AI Lab' },
  { id: 'my-devs', icon: '\u{1F4C1}', label: 'My Devs' },
  { id: 'shop', icon: '\u{1F6D2}', label: 'Shop' },
  { id: 'lore', icon: '\u{1F4D6}', label: 'Lore' },
  { id: 'control-panel', icon: '\u2699', label: 'Settings' },
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

  const refreshWallpaper = useCallback(() => {
    setWallpaperStyle(getWallpaperStyle());
    setWallpaperOverlay(getWallpaperOverlay());
  }, []);

  useEffect(() => {
    openWindow('live-feed');
  }, []);

  useEffect(() => {
    window.addEventListener('nx-settings-changed', refreshWallpaper);
    return () => window.removeEventListener('nx-settings-changed', refreshWallpaper);
  }, [refreshWallpaper]);

  const handleTaskbarClick = (id) => {
    const win = windows.find(w => w.id === id);
    if (win && !win.minimized) {
      minimizeWindow(id);
    } else {
      openWindow(id);
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

      <NXAssistant />

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        openWindow={openWindow}
      />
    </div>
  );
}
