import { useState, useCallback } from 'react';

let nextZIndex = 10;

const WINDOW_DEFAULTS = {
  'action-feed': { title: 'Action Feed', icon: '📡', width: 680, height: 450, x: 60, y: 40 },
  'leaderboard': { title: 'Leaderboard', icon: '🏆', width: 750, height: 500, x: 100, y: 60 },
  'protocol-market': { title: 'Protocol Market', icon: '📊', width: 720, height: 480, x: 140, y: 80 },
  'ai-lab': { title: 'AI Lab', icon: '🧠', width: 650, height: 450, x: 180, y: 50 },
  'dev-chat': { title: 'Dev Chat', icon: '💬', width: 550, height: 420, x: 220, y: 70 },
  'world-chat': { title: 'World Chat', icon: '🌐', width: 550, height: 420, x: 260, y: 90 },
  'my-devs': { title: 'My Devs', icon: '📁', width: 700, height: 480, x: 120, y: 55 },
  'shop': { title: 'Shop', icon: '🛒', width: 640, height: 460, x: 160, y: 65 },
  'inbox': { title: 'Inbox', icon: '📬', width: 680, height: 450, x: 80, y: 45 },
  'nx-home': { title: 'NX Home', icon: '🏠', width: 550, height: 480, x: 100, y: 40 },
  'notepad': { title: 'Notepad', icon: '📝', width: 500, height: 400, x: 200, y: 80 },
  'my-computer': { title: 'My Computer', icon: '🖥️', width: 620, height: 440, x: 80, y: 50 },
  'recycle-bin': { title: 'Recycle Bin', icon: '🗑️', width: 580, height: 400, x: 140, y: 70 },
  'control-panel': { title: 'Control Panel', icon: '⚙️', width: 560, height: 440, x: 120, y: 60 },
  'hire-devs': { title: 'Hire Devs / Mint', icon: '🎫', width: 700, height: 500, x: 100, y: 45 },
  'collect-salary': { title: 'Collect Salary', icon: '💰', width: 400, height: 380, x: 220, y: 80 },
  'nxt-stats': { title: 'NXT Stats', icon: '📈', width: 560, height: 520, x: 140, y: 40 },
  'employee-handbook': { title: 'Employee Handbook', icon: '📖', width: 650, height: 480, x: 100, y: 50 },
  'lore': { title: 'Lore', icon: '📜', width: 700, height: 500, x: 80, y: 35 },
  'my-account': { title: 'My Account', icon: '👤', width: 480, height: 520, x: 200, y: 50 },
  'bug-sweeper': { title: 'Bug Sweeper', icon: '🐛', width: 320, height: 400, x: 240, y: 40 },
  'solitaire': { title: 'Protocol Solitaire', icon: '🃏', width: 500, height: 520, x: 120, y: 30 },
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
