import { useState, useCallback } from 'react';

let nextZIndex = 10;

const WINDOW_DEFAULTS = {
  'live-feed': { title: 'Live Feed', icon: '>>', width: 680, height: 450, x: 60, y: 40 },
  'leaderboard': { title: 'Leaderboard', icon: '*', width: 750, height: 500, x: 100, y: 60 },
  'protocol-market': { title: 'Protocol Market', icon: '$', width: 720, height: 480, x: 140, y: 80 },
  'ai-lab': { title: 'AI Lab', icon: '~', width: 650, height: 450, x: 180, y: 50 },
  'world-chat': { title: 'World Chat', icon: '#', width: 550, height: 420, x: 260, y: 90 },
  'my-devs': { title: 'My Devs', icon: '=', width: 700, height: 480, x: 120, y: 55 },
  'nxt-wallet': { title: 'NXT Wallet', icon: '$', width: 720, height: 500, x: 90, y: 45 },
  'control-panel': { title: 'Control Panel', icon: '::', width: 520, height: 420, x: 200, y: 80 },
  'nx-terminal': { title: 'NX Terminal', icon: '>_', width: 580, height: 440, x: 90, y: 50 },
  'bug-sweeper': { title: 'Bug Sweeper', icon: '%', width: 300, height: 380, x: 220, y: 60 },
  'protocol-solitaire': { title: 'Protocol Solitaire', icon: '\u2660', width: 620, height: 540, x: 100, y: 30 },
  'inbox': { title: 'Inbox', icon: 'M', width: 620, height: 450, x: 110, y: 45 },
  'hire-devs': { title: 'Mint/Hire Devs', icon: '+', width: 640, height: 500, x: 130, y: 55 },
  'notepad': { title: 'Notepad', icon: 'N', width: 500, height: 420, x: 160, y: 65 },
  'recycle-bin': { title: 'Recycle Bin', icon: 'x', width: 560, height: 400, x: 170, y: 70 },
  'corp-wars': { title: 'Corporation Wars', icon: '\u2694', width: 720, height: 550, x: 160, y: 50 },
};

export function useWindowManager() {
  const [windows, setWindows] = useState([]);

  const openWindow = useCallback((id, extraProps = {}) => {
    setWindows(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing) {
        nextZIndex++;
        return prev.map(w =>
          w.id === id ? { ...w, minimized: false, zIndex: nextZIndex } : w
        );
      }

      const defaults = WINDOW_DEFAULTS[id] || { title: id, icon: '>', width: 600, height: 400, x: 100 + prev.length * 30, y: 60 + prev.length * 30 };
      nextZIndex++;
      return [...prev, {
        id,
        title: defaults.title,
        icon: defaults.icon,
        position: { x: defaults.x, y: defaults.y },
        size: { width: defaults.width, height: defaults.height },
        minimized: false,
        maximized: false,
        zIndex: nextZIndex,
        ...extraProps,
      }];
    });
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id) => {
    nextZIndex++;
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, zIndex: nextZIndex } : w
    ));
  }, []);

  const minimizeWindow = useCallback((id) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, minimized: !w.minimized } : w
    ));
  }, []);

  const maximizeWindow = useCallback((id) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, maximized: !w.maximized } : w
    ));
  }, []);

  const moveWindow = useCallback((id, position) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, position } : w
    ));
  }, []);

  const openDevProfile = useCallback((devId) => {
    const windowId = `dev-profile-${devId}`;
    nextZIndex++;
    setWindows(prev => {
      const existing = prev.find(w => w.id === windowId);
      if (existing) {
        return prev.map(w =>
          w.id === windowId ? { ...w, minimized: false, zIndex: nextZIndex } : w
        );
      }
      return [...prev, {
        id: windowId,
        title: `Dev #${devId}`,
        icon: '@',
        position: { x: 150 + (prev.length % 5) * 30, y: 70 + (prev.length % 5) * 30 },
        size: { width: 700, height: 520 },
        minimized: false,
        maximized: false,
        zIndex: nextZIndex,
        devId,
      }];
    });
  }, []);

  return {
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    openDevProfile,
  };
}
