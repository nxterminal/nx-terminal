import { useState, useCallback } from 'react';

let nextZIndex = 10;

const WINDOW_DEFAULTS = {
  'nx-home': { title: 'NX Terminal \u2014 Home', icon: '\u{1F5A5}', width: 720, height: 520, x: 80, y: 30 },
  'inbox': { title: 'Inbox \u2014 Corporate Mail', icon: '\u2709', width: 650, height: 450, x: 100, y: 50 },
  'hire-devs': { title: 'Hire Devs \u2014 MegaETH Network', icon: '\u{1F4DB}', width: 600, height: 500, x: 130, y: 40 },
  'action-feed': { title: 'Live Feed', icon: '\u{1F4E1}', width: 680, height: 450, x: 60, y: 40 },
  'leaderboard': { title: 'Rankings', icon: '\u{1F3C6}', width: 750, height: 500, x: 100, y: 60 },
  'protocol-market': { title: 'Protocol Market', icon: '\u{1F4CA}', width: 720, height: 480, x: 140, y: 80 },
  'ai-lab': { title: 'AI Lab', icon: '\u{1F9E0}', width: 650, height: 450, x: 180, y: 50 },
  'dev-chat': { title: 'Dev Chat', icon: '\u{1F4AC}', width: 550, height: 420, x: 220, y: 70 },
  'world-chat': { title: 'World Chat', icon: '\u{1F310}', width: 550, height: 420, x: 260, y: 90 },
  'my-devs': { title: 'My Devs', icon: '\u{1F4C1}', width: 700, height: 480, x: 120, y: 55 },
  'shop': { title: 'Company Store', icon: '\u{1F6D2}', width: 640, height: 460, x: 160, y: 65 },
  'handbook': { title: 'Employee Handbook \u2014 NX Terminal', icon: '\u{1F4D6}', width: 680, height: 520, x: 90, y: 35 },
  'my-account': { title: 'My Account \u2014 Employee Dashboard', icon: '\u{1F464}', width: 600, height: 420, x: 170, y: 60 },
  'collect-salary': { title: 'Collect Salary', icon: '\u{1F4B0}', width: 550, height: 440, x: 200, y: 70 },
  'nxt-stats': { title: '$NXT Stats', icon: '\u{1F4C8}', width: 720, height: 480, x: 110, y: 45 },
  'lore': { title: 'Lore \u2014 The Protocol Wars', icon: '\u{1F4DC}', width: 680, height: 520, x: 95, y: 38 },
};

export function useWindowManager() {
  const [windows, setWindows] = useState([]);

  const openWindow = useCallback((id, extraProps = {}) => {
    setWindows(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing) {
        // Focus and unminimize
        nextZIndex++;
        return prev.map(w =>
          w.id === id ? { ...w, minimized: false, zIndex: nextZIndex } : w
        );
      }

      const defaults = WINDOW_DEFAULTS[id] || { title: id, icon: '📄', width: 600, height: 400, x: 100 + prev.length * 30, y: 60 + prev.length * 30 };
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
        icon: '👤',
        position: { x: 150 + (prev.length % 5) * 30, y: 70 + (prev.length % 5) * 30 },
        size: { width: 700, height: 520 },
        minimized: false,
        maximized: false,
        zIndex: nextZIndex,
        devId,
      }];
    });
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  return {
    windows,
    openWindow,
    closeWindow,
    closeAllWindows,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    openDevProfile,
  };
}
