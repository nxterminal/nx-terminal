import { useState, useCallback } from 'react';

export function useFlowState() {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('flow-active-tab') || 'stream';
  });

  const [streamFilters, setStreamFilters] = useState({
    minValue: 0,
    protocol: 'all',
    side: 'all',
  });

  const [isPaused, setIsPaused] = useState(false);

  const setTab = useCallback((tabId) => {
    setActiveTab(tabId);
    sessionStorage.setItem('flow-active-tab', tabId);
  }, []);

  const setStreamFilter = useCallback((key, value) => {
    setStreamFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return {
    activeTab,
    setTab,
    streamFilters,
    setStreamFilter,
    isPaused,
    togglePause,
  };
}
