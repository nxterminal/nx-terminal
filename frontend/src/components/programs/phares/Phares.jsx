import { useEffect, useState } from 'react';
import { TABS, HEADER_METRICS } from './constants';
import { usePharesState } from './hooks/usePharesState';
import { useWallet } from '../../../hooks/useWallet';
import { api } from '../../../services/api';
import ActiveMarkets from './tabs/ActiveMarkets';
import MyPositions from './tabs/MyPositions';
import Resolved from './tabs/Resolved';
import LeaderboardTab from './tabs/Leaderboard';
import BetPanel from './components/BetPanel';
import PositionsPanel from './components/PositionsPanel';
import LeaderboardPanel from './components/LeaderboardPanel';
import './Phares.css';

const TAB_COMPONENTS = {
  markets: ActiveMarkets,
  positions: MyPositions,
  resolved: Resolved,
  leaderboard: LeaderboardTab,
};

function formatBalance(n) {
  if (n == null || n === 0) return '0';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Phares() {
  const {
    activeTab,
    setTab,
    selectedMarket,
    selectMarket,
    selectedSide,
    setSelectedSide,
    betAmount,
    setBetAmount,
  } = usePharesState();

  const { address, isConnected, connect, displayAddress } = useWallet();
  const [nxtBalance, setNxtBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    // Load Outfit font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Force parent overflow hidden (same pattern as Flow)
    const el = document.querySelector('.phares-root');
    if (el) {
      let parent = el.parentElement;
      while (parent && !parent.classList.contains('desktop')) {
        parent.style.overflow = 'hidden';
        parent = parent.parentElement;
      }
    }

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Fetch NXT balance when wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
      setNxtBalance(null);
      return;
    }

    setLoadingBalance(true);
    api.getWalletSummary(address)
      .then(data => {
        setNxtBalance(data.balance_claimable || 0);
      })
      .catch(() => {
        // If API fails, show 0
        setNxtBalance(0);
      })
      .finally(() => setLoadingBalance(false));
  }, [isConnected, address]);

  const TabContent = TAB_COMPONENTS[activeTab];
  const balanceDisplay = loadingBalance ? '...' : formatBalance(nxtBalance);

  return (
    <div className="phares-root">
      {/* Header */}
      <header className="phares-header">
        <div className="phares-header-left">
          <div className="phares-logo-mark">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 4L15 4" stroke="#08090c" strokeWidth="2" strokeLinecap="round" />
              <path d="M5 9L17 9" stroke="#08090c" strokeWidth="2" strokeLinecap="round" />
              <path d="M1 14L13 14" stroke="#08090c" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="phares-logo-text">PHARES</span>
          <span className="phares-header-divider" />
          <span className="phares-logo-sub">Prediction Markets</span>
        </div>

        <div className="phares-header-right">
          <div className="phares-header-metrics">
            <div className="phares-metric">
              <span className="phares-metric-label">MARKETS</span>
              <span className="phares-metric-value">{HEADER_METRICS.markets}</span>
            </div>
            <div className="phares-metric">
              <span className="phares-metric-label">VOLUME</span>
              <span className="phares-metric-value">{HEADER_METRICS.volume}</span>
            </div>
            <div className="phares-metric">
              <span className="phares-metric-label">TRADERS</span>
              <span className="phares-metric-value">{HEADER_METRICS.traders}</span>
            </div>
          </div>
          <button className="phares-connect-btn" onClick={isConnected ? undefined : connect}>
            {isConnected ? displayAddress : 'CONNECT WALLET'}
          </button>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="phares-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`phares-nav-tab ${activeTab === tab.id ? 'phares-nav-tab--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="phares-nav-badge">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <div className="phares-content">
        <div className="phares-main">
          <TabContent
            selectedMarket={selectedMarket}
            onSelectMarket={selectMarket}
          />
        </div>
        <aside className="phares-sidebar">
          <BetPanel
            selectedMarket={selectedMarket}
            selectedSide={selectedSide}
            setSelectedSide={setSelectedSide}
            betAmount={betAmount}
            setBetAmount={setBetAmount}
            walletConnected={isConnected}
            nxtBalance={nxtBalance}
            balanceDisplay={balanceDisplay}
          />
          <PositionsPanel />
          <LeaderboardPanel />
        </aside>
      </div>
    </div>
  );
}
