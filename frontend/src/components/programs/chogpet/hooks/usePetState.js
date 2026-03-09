import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DEFAULT_PET_STATE,
  PET_TYPES,
  HUNGER_DECAY_MS,
  HAPPINESS_DECAY_MS,
  FEED_XP,
  PET_XP,
  FEED_HUNGER,
  PET_HAPPINESS,
  getLevel,
} from '../constants';

const STORAGE_KEY = 'chogpet-state';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Apply decay since last interaction
      const now = Date.now();
      const elapsed = now - (parsed.lastInteraction || now);
      const hungerLost = Math.floor(elapsed / HUNGER_DECAY_MS);
      const happinessLost = Math.floor(elapsed / HAPPINESS_DECAY_MS) * 0.5;
      return {
        ...DEFAULT_PET_STATE,
        ...parsed,
        hunger: Math.max(0, (parsed.hunger || 80) - hungerLost),
        happiness: Math.max(0, (parsed.happiness || 80) - happinessLost),
        lastInteraction: now,
      };
    }
  } catch {}
  return { ...DEFAULT_PET_STATE, lastFed: Date.now(), lastInteraction: Date.now() };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function usePetState() {
  const [state, setState] = useState(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Hunger & happiness decay
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const next = {
          ...prev,
          hunger: Math.max(0, prev.hunger - 1),
          happiness: Math.max(0, prev.happiness - 0.5),
          lastInteraction: Date.now(),
        };
        return next;
      });
    }, HUNGER_DECAY_MS);
    return () => clearInterval(interval);
  }, []);

  // Listen for external state changes (from other component instances)
  useEffect(() => {
    const handler = () => {
      const fresh = loadState();
      setState(fresh);
    };
    window.addEventListener('nx-pet-changed', handler);
    return () => window.removeEventListener('nx-pet-changed', handler);
  }, []);

  const notify = useCallback(() => {
    window.dispatchEvent(new Event('nx-pet-changed'));
  }, []);

  const feed = useCallback(() => {
    setState(prev => {
      const next = {
        ...prev,
        hunger: Math.min(100, prev.hunger + FEED_HUNGER),
        xp: prev.xp + FEED_XP,
        lastFed: Date.now(),
        lastInteraction: Date.now(),
      };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const pet = useCallback(() => {
    setState(prev => {
      const next = {
        ...prev,
        happiness: Math.min(100, prev.happiness + PET_HAPPINESS),
        xp: prev.xp + PET_XP,
        lastInteraction: Date.now(),
      };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const addXP = useCallback((amount) => {
    setState(prev => {
      const next = { ...prev, xp: prev.xp + amount, lastInteraction: Date.now() };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const changePet = useCallback((petType) => {
    if (!PET_TYPES[petType]) return;
    setState(prev => {
      const next = {
        ...prev,
        petType,
        name: PET_TYPES[petType].name,
        lastInteraction: Date.now(),
      };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const rename = useCallback((name) => {
    setState(prev => {
      const next = { ...prev, name: name || prev.name, lastInteraction: Date.now() };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const toggleHelper = useCallback(() => {
    setState(prev => {
      const next = { ...prev, helperMode: !prev.helperMode, lastInteraction: Date.now() };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const toggleActive = useCallback(() => {
    setState(prev => {
      const next = { ...prev, isActive: !prev.isActive, lastInteraction: Date.now() };
      saveState(next);
      return next;
    });
    notify();
  }, [notify]);

  const setPosition = useCallback((pos) => {
    setState(prev => {
      const next = { ...prev, position: pos, lastInteraction: Date.now() };
      saveState(next);
      return next;
    });
    // Don't notify for position changes (too frequent during drag)
  }, []);

  const level = getLevel(state.xp);

  return {
    ...state,
    level,
    feed,
    pet,
    addXP,
    changePet,
    rename,
    toggleHelper,
    toggleActive,
    setPosition,
  };
}
