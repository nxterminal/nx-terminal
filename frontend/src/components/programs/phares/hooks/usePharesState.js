import { useState, useCallback } from 'react';
import { MARKETS } from '../constants';

export function usePharesState() {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('phares-active-tab') || 'markets';
  });
  const [selectedMarket, setSelectedMarket] = useState(MARKETS[0]);
  const [selectedSide, setSelectedSide] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);

  const setTab = useCallback((tabId) => {
    setActiveTab(tabId);
    sessionStorage.setItem('phares-active-tab', tabId);
  }, []);

  const selectMarket = useCallback((market) => {
    setSelectedMarket(market);
    setSelectedSide(null);
    setBetAmount('');
  }, []);

  const toggleWallet = useCallback(() => {
    setWalletConnected(prev => !prev);
  }, []);

  return {
    activeTab,
    setTab,
    selectedMarket,
    selectMarket,
    selectedSide,
    setSelectedSide,
    betAmount,
    setBetAmount,
    walletConnected,
    toggleWallet,
  };
}
