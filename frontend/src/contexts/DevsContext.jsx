import { createContext, useContext, useState, useCallback } from 'react';

// ============================================
// TEST DATA — remove before production
// ============================================
const TEST_DEVS = [
  { id: 1, token_id: 1, name: 'NEXUS-7X', personality: 'Closed AI', archetype: 'GRINDER', energy: 85, mood: 'Caffeinated', balance_nxt: 3200, level: 4 },
  { id: 2, token_id: 2, name: 'VOID-X', personality: 'Misanthropic', archetype: 'HACKTIVIST', energy: 42, mood: 'Existential', balance_nxt: 1800, level: 3 },
  { id: 3, token_id: 3, name: 'SPARK-3', personality: 'GooglAI', archetype: '10X_DEV', energy: 91, mood: 'Manic', balance_nxt: 5100, level: 5 },
];
// ============================================

const DevsContext = createContext(null);

export function DevsProvider({ children }) {
  const [devs, setDevs] = useState(TEST_DEVS);

  const addDev = useCallback((dev) => {
    setDevs(prev => {
      const nextId = prev.length + 1;
      return [...prev, { ...dev, id: nextId, token_id: nextId }];
    });
  }, []);

  const totalSalary = devs.reduce((sum, d) => sum + (d.level || 1) * 250, 0);

  return (
    <DevsContext.Provider value={{ devs, addDev, totalSalary }}>
      {children}
    </DevsContext.Provider>
  );
}

export function useDevs() {
  const ctx = useContext(DevsContext);
  if (!ctx) throw new Error('useDevs must be inside DevsProvider');
  return ctx;
}
