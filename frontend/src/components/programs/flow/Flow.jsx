import { useState, useEffect } from 'react';
import { TABS, COLORS } from './constants';
import { useFlowState } from './hooks/useFlowState';
import { useMarketData } from './hooks/useMarketData';
import StatusDot from './components/StatusDot';
import TheStream from './tabs/TheStream';
import WalletXRay from './tabs/WalletXRay';
import TokenRadar from './tabs/TokenRadar';
import ClobVision from './tabs/ClobVision';
import AiOracle from './tabs/AiOracle';
import './Flow.css';

const TAB_COMPONENTS = {
  stream: TheStream,
  wallet: WalletXRay,
  radar: TokenRadar,
  clob: ClobVision,
  ai: AiOracle,
};

function formatNumber(num) {
  if (num == null || isNaN(num)) return '--';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

function formatPrice(price) {
  if (price == null || isNaN(price)) return '--';
  if (price >= 1) return '$' + price.toFixed(2);
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

export default function Flow({ onClose }) {
  const { activeTab, setTab, streamFilters, setStreamFilter, isPaused, togglePause } = useFlowState();
  const market = useMarketData();

  const [tabFade, setTabFade] = useState(true);

  useEffect(() => {
    setTabFade(false);
    const t = requestAnimationFrame(() => setTabFade(true));
    return () => cancelAnimationFrame(t);
  }, [activeTab]);

  const ActiveTabComponent = TAB_COMPONENTS[activeTab] || TheStream;

  const connectionStatus = market.isConnected ? 'live' : 'offline';
  const changeColor = market.monChange24h > 0 ? COLORS.buy : market.monChange24h < 0 ? COLORS.sell : COLORS.text;

  return (
    <div className="flow-container">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />

      <div className="flow-bg-glow flow-bg-glow--green" />
      <div className="flow-bg-glow flow-bg-glow--indigo" />

      {/* HEADER BAR */}
      <div className="flow-header">
        <div className="flow-header__left">
          <span className="flow-header__logo">FLOW</span>
          <span className="flow-header__sep">|</span>
          <span className="flow-header__subtitle">DeFi Intelligence</span>
        </div>

        <div className="flow-header__center">
          <span className="flow-header__stat">
            <StatusDot status={connectionStatus} />
            <span style={{ color: market.isConnected ? COLORS.accent : COLORS.danger, marginLeft: 6 }}>
              {market.isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </span>
          <span className="flow-header__dot">&middot;</span>
          <span className="flow-header__stat">
            TPS <span className="flow-header__val">{formatNumber(market.tps)}</span>
          </span>
          <span className="flow-header__dot">&middot;</span>
          <span className="flow-header__stat">
            Block <span className="flow-header__val">#{formatNumber(market.blockNumber)}</span>
          </span>
          <span className="flow-header__dot">&middot;</span>
          <span className="flow-header__stat">
            MON <span className="flow-header__val" style={{ color: changeColor }}>
              {formatPrice(market.monPrice)}
            </span>
          </span>
          <span className="flow-header__dot">&middot;</span>
          <span className="flow-header__stat">
            Gas <span className="flow-header__val">{market.gasPrice ? market.gasPrice.toFixed(4) : '--'}</span>
          </span>
        </div>

        <div className="flow-header__right">
          Monad &middot; Chain 143 &middot; 400ms
        </div>
      </div>

      {/* TAB BAR */}
      <div className="flow-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`flow-tab ${activeTab === tab.id ? 'flow-tab--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flow-content" style={{ opacity: tabFade ? 1 : 0 }}>
        <ActiveTabComponent
          streamFilters={streamFilters}
          setStreamFilter={setStreamFilter}
          isPaused={isPaused}
          togglePause={togglePause}
          market={market}
        />
      </div>
    </div>
  );
}
