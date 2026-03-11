import { useState, useEffect, useRef } from 'react';
import { TABS, COLORS, TOOLTIPS } from './constants';
import { useFlowState } from './hooks/useFlowState';
import { useMarketData } from './hooks/useMarketData';
import { useStreamData } from './hooks/useStreamData';
import StatusDot from './components/StatusDot';
import Tooltip from './components/Tooltip';
import TheStream from './tabs/TheStream';
import WalletXRay from './tabs/WalletXRay';
import TokenRadar from './tabs/TokenRadar';
import ClobVision from './tabs/ClobVision';
import AiOracle from './tabs/AiOracle';
import HelpGuide from './tabs/HelpGuide';
import './Flow.css';

const TAB_COMPONENTS = {
  stream: TheStream,
  wallet: WalletXRay,
  radar: TokenRadar,
  clob: ClobVision,
  ai: AiOracle,
  help: HelpGuide,
};

const TAB_TOOLTIPS = {
  stream: TOOLTIPS.theStream,
  wallet: TOOLTIPS.walletXray,
  radar: TOOLTIPS.tokenRadar,
  clob: TOOLTIPS.clobVision,
  ai: TOOLTIPS.aiOracle,
  help: 'User guide and documentation for FLOW.exe',
};

const BOOT_LINES = [
  { text: 'FLOW.exe v1.0 — DeFi Intelligence Terminal', color: '#8B5CF6', delay: 0 },
  { text: '(C) 2026 NX TERMINAL CORP', color: '#555D6B', delay: 150 },
  { text: '', delay: 300 },
  { text: 'CONNECTING TO MONAD RPC...', color: '#8B5CF6', delay: 400 },
  { text: '  Chain ID: 143 ................................. OK', color: '#555D6B', delay: 700 },
  { text: '  Block time: 400ms ............................. OK', color: '#555D6B', delay: 900 },
  { text: '', delay: 1050 },
  { text: 'LOADING MODULES', color: '#C8D6E5', delay: 1100 },
  { text: '  > The Stream — real-time trade feed ........... OK', color: '#555D6B', delay: 1300 },
  { text: '  > Wallet X-Ray — on-chain analysis ............ OK', color: '#555D6B', delay: 1500 },
  { text: '  > Token Radar — pool scoring engine ........... OK', color: '#555D6B', delay: 1700 },
  { text: '  > CLOB Vision — orderbook visualization ....... OK', color: '#555D6B', delay: 1900 },
  { text: '  > AI Oracle — intelligence layer .............. OK', color: '#555D6B', delay: 2100 },
  { text: '', delay: 2250 },
  { text: 'INITIALIZING MARKET DATA FEEDS .................. OK', color: '#8B5CF6', delay: 2350 },
  { text: 'GECKOTERMINAL API ............................... OK', color: '#8B5CF6', delay: 2550 },
  { text: 'COINGECKO PRICE ORACLE .......................... OK', color: '#8B5CF6', delay: 2700 },
  { text: '', delay: 2850 },
  { text: 'ALL SYSTEMS NOMINAL. ENTERING FLOW STATE.', color: '#8B5CF6', delay: 2950 },
];

const BOOT_DURATION = 3400;

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

function BootScreen({ onDone }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    const progressTimer = setInterval(() => {
      setProgress(prev => Math.min(prev + 3, 100));
    }, BOOT_DURATION / 33);
    const doneTimer = setTimeout(() => onDoneRef.current(), BOOT_DURATION);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="flow-boot">
      <div className="flow-boot__title">FLOW.exe</div>
      <div className="flow-boot__subtitle">DeFi Intelligence Terminal — Monad Network</div>

      {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
        <div key={i} className="flow-boot__line" style={{ color: line.color }}>
          {line.text.includes('OK') ? (
            <>
              {line.text.replace(' OK', '')}
              <span className="flow-boot__ok"> OK</span>
            </>
          ) : line.text}
        </div>
      ))}

      <div className="flow-boot__progress">
        <div className="flow-boot__progress-fill" style={{ width: progress + '%' }} />
      </div>
    </div>
  );
}

export default function Flow({ onClose }) {
  const { activeTab, setTab, streamFilters, setStreamFilter, isPaused, togglePause } = useFlowState();
  const market = useMarketData();
  const stream = useStreamData(isPaused);

  const [booting, setBooting] = useState(() => {
    return !sessionStorage.getItem('flow-booted');
  });
  const [bootFade, setBootFade] = useState(false);
  const [tabFade, setTabFade] = useState(true);

  // Track unseen trades when not on stream tab
  const [unseenTrades, setUnseenTrades] = useState(0);
  const lastSeenCount = useRef(stream.tradeCount);

  useEffect(() => {
    if (activeTab === 'stream') {
      setUnseenTrades(0);
      lastSeenCount.current = stream.tradeCount;
    } else {
      const newTrades = stream.tradeCount - lastSeenCount.current;
      if (newTrades > 0) setUnseenTrades(newTrades);
    }
  }, [activeTab, stream.tradeCount]);

  const handleBootDone = () => {
    setBootFade(true);
    sessionStorage.setItem('flow-booted', '1');
    setTimeout(() => setBooting(false), 300);
  };

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

      {/* BOOT SCREEN */}
      {booting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, background: '#0D1117',
          opacity: bootFade ? 0 : 1, transition: 'opacity 0.3s ease',
        }}>
          <BootScreen onDone={handleBootDone} />
        </div>
      )}

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
          <Tooltip text="Connection status to Monad RPC node">
            <span className="flow-header__stat">
              <StatusDot status={connectionStatus} />
              <span style={{ color: market.isConnected ? COLORS.accent : COLORS.danger, marginLeft: 6 }}>
                {market.isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </span>
          </Tooltip>
          <span className="flow-header__dot">&middot;</span>
          <Tooltip text={TOOLTIPS.tps}>
            <span className="flow-header__stat">
              TPS <span className="flow-header__val">{formatNumber(market.tps)}</span>
            </span>
          </Tooltip>
          <span className="flow-header__dot">&middot;</span>
          <Tooltip text={TOOLTIPS.block}>
            <span className="flow-header__stat">
              Block <span className="flow-header__val">#{formatNumber(market.blockNumber)}</span>
            </span>
          </Tooltip>
          <span className="flow-header__dot">&middot;</span>
          <Tooltip text={TOOLTIPS.monPrice}>
            <span className="flow-header__stat">
              MON <span className="flow-header__val" style={{ color: changeColor }}>
                {formatPrice(market.monPrice)}
              </span>
            </span>
          </Tooltip>
          <span className="flow-header__dot">&middot;</span>
          <Tooltip text={TOOLTIPS.gas}>
            <span className="flow-header__stat">
              Gas <span className="flow-header__val">{market.gasPrice ? market.gasPrice.toFixed(4) : '--'}</span>
            </span>
          </Tooltip>
        </div>

        <div className="flow-header__right">
          Monad &middot; Chain 143 &middot; 400ms
        </div>
      </div>

      {/* TAB BAR */}
      <div className="flow-tabs">
        {TABS.map(tab => (
          <Tooltip key={tab.id} text={TAB_TOOLTIPS[tab.id]}>
            <button
              className={`flow-tab ${activeTab === tab.id ? 'flow-tab--active' : ''}`}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'stream' && unseenTrades > 0 && activeTab !== 'stream' && (
                <span className="flow-tab__badge">
                  {unseenTrades > 99 ? '99+' : unseenTrades}
                </span>
              )}
            </button>
          </Tooltip>
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
          stream={stream}
          onNavigate={setTab}
        />
      </div>
    </div>
  );
}
