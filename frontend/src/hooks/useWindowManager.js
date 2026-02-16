import { useState, useCallback } from 'react';

let nextZIndex = 10;

const WINDOW_DEFAULTS = {
  'live-feed': { title: 'Live Feed', icon: '\u{1F465}', width: 680, height: 450, x: 60, y: 40 },
  'leaderboard': { title: 'Leaderboard', icon: '\u{1F3C6}', width: 750, height: 500, x: 100, y: 60 },
  'protocol-market': { title: 'Protocol Market', icon: '\u{1F4CA}', width: 720, height: 480, x: 140, y: 80 },
  'ai-lab': { title: 'AI Lab', icon: '\u{1F9E0}', width: 650, height: 450, x: 180, y: 50 },
  'world-chat': { title: 'World Chat', icon: '\u{1F310}', width: 550, height: 420, x: 260, y: 90 },
  'my-devs': { title: 'My Devs', icon: '\u{1F4C1}', width: 700, height: 480, x: 120, y: 55 },
  'shop': { title: 'Shop', icon: '\u{1F6D2}', width: 640, height: 460, x: 160, y: 65 },
  'lore': { title: 'Lore', icon: '\u{1F4D6}', width: 620, height: 480, x: 130, y: 50 },
  'control-panel': { title: 'Control Panel', icon: '\u2699', width: 520, height: 420, x: 200, y: 80 },
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

      const defaults = WINDOW_DEFAULTS[id] || { title: id, icon: '\u{1F4C4}', width: 600, height: 400, x: 100 + prev.length * 30, y: 60 + prev.length * 30 };
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
        icon: '\u{1F464}',
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
