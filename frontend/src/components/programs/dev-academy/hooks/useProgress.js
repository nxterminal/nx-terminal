import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';

function getSessionId() {
  let sid = localStorage.getItem('da-session-id-v2');
  if (!sid) {
    sid = 'demo-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('da-session-id-v2', sid);
  }
  return sid;
}

export function useProgress(wallet, devId) {
  const [progress, setProgress] = useState({});
  const [xp, setXp] = useState(0);
  const isDemo = !wallet || devId === 0;

  useEffect(() => {
    const key = isDemo ? getSessionId() : wallet;
    fetch(`${API_BASE}/api/academy/progress?key=${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProgress(data.progress || {});
          setXp(data.xp || 0);
        }
      })
      .catch(() => {
        // Offline: load from localStorage fallback
        try {
          const saved = localStorage.getItem(`da-progress-${key}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setProgress(parsed.progress || {});
            setXp(parsed.xp || 0);
          }
        } catch { /* ignore */ }
      });
  }, [wallet, isDemo]);

  const completeLesson = useCallback(async (lessonId, pathId, lessonXp) => {
    setProgress(p => ({ ...p, [lessonId]: true }));
    setXp(x => x + lessonXp);

    const key = isDemo ? getSessionId() : wallet;

    // Save to localStorage as fallback
    try {
      const current = JSON.parse(localStorage.getItem(`da-progress-${key}`) || '{"progress":{},"xp":0}');
      current.progress[lessonId] = true;
      current.xp = (current.xp || 0) + lessonXp;
      localStorage.setItem(`da-progress-${key}`, JSON.stringify(current));
    } catch { /* ignore */ }

    // Save to backend
    try {
      await fetch(`${API_BASE}/api/academy/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          devId: devId || 0,
          lessonId,
          pathId,
          xp: lessonXp,
        }),
      });
    } catch { /* offline, localStorage has the data */ }
  }, [wallet, devId, isDemo]);

  return { progress, xp, completeLesson };
}
