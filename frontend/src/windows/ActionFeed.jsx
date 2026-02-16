import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444',
  'LURKER': '#808080',
  'DEGEN': '#ffd700',
  'GRINDER': '#4488ff',
  'INFLUENCER': '#ff44ff',
  'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00',
  'SCRIPT_KIDDIE': '#00ffff',
};

const ACTION_ICONS = {
  code: '>>', trade: '$', chat: '#', hack: '!',
  create_protocol: '+', invest: '%', create_ai: '*', mint: '@', default: '>',
};

const ARCHETYPES = Object.keys(ARCHETYPE_COLORS);
const ACTION_TYPES = ['code', 'trade', 'chat', 'hack', 'create_protocol', 'invest', 'create_ai', 'mint'];

const DEV_NAMES = [
  'CryptoKing_42', 'NullPtr_Dev', 'ShadowCoder_X', 'MoonTrader99', 'DegenApe_777',
  'Silent_Observer', 'GrindMaster_7', 'H4CK3R_PR1M3', 'Agent_Smith_42', 'CopyPasta_Kid',
  'ByteRunner_0x', 'QuantumLeap_AI', 'RustLord_420', 'ZeroDay_Hunter', 'TokenWhale_88',
  'PhantomDev_13', 'AlphaSeeker_X', 'BugBounty_Pro', 'ChainBreaker_9', 'DarkPool_Lurk',
  'EthMaxi_2049', 'FlashLoan_Kid', 'GasOptimizer', 'HodlGang_OG', 'IronDev_99',
  'JeetDetector', 'KeccakCrush', 'LiquidityNinja', 'MEV_Hunter_X', 'NonceSniffer',
  'OracleWhisper', 'PendingTx_404', 'RevertKing_0x', 'SolidityGod', 'TxPoolWatcher',
];

const DETAILS_MAP = {
  code: ['pushed 47 commits to main', 'refactored smart contract logic', 'deployed v2.1 to testnet', 'fixed critical reentrancy bug', 'optimized gas usage by 30%', 'wrote 200 lines of Solidity', 'merged PR #847 into production', 'compiled protocol_engine.sol', 'audited token contract', 'shipped new governance module'],
  trade: ['bought 500 $PROTO at 0.42', 'sold 1200 $NXT for profit', 'swapped ETH for $DEGEN', 'market sold 800 tokens (panic)', 'limit order filled at 1.337', 'arbitraged 3% spread on DEX', 'dumped bags (sorry not sorry)', 'aped into new liquidity pool', 'shorted $RUGCOIN successfully', 'flash traded 10k in 2 blocks'],
  chat: ['posted alpha in #trollbox', 'started flame war about L2s', 'shared meme in #general', 'warned about incoming dump', 'asked "wen moon?" for 50th time', 'leaked insider info (allegedly)', 'debated gas fees in #tech', 'recruited devs in #hiring', 'trash-talked rival corp', 'spread FUD about competitor'],
  hack: ['exploited flash loan vulnerability', 'found SQL injection in oracle', 'bypassed rate limiter on API', 'reverse engineered competitor protocol', 'discovered admin key in repo', 'brute-forced weak encryption', 'infiltrated rival corp network', 'extracted unprotected API keys', 'injected malicious governance vote', 'sandwiched large pending tx'],
  create_protocol: ['launched DeFi lending protocol', 'deployed NFT marketplace v3', 'created new yield aggregator', 'built cross-chain bridge', 'shipped DAO governance framework', 'released perpetual DEX', 'deployed automated market maker'],
  invest: ['invested 2000 $NXT in SafeYield', 'backed new protocol at seed round', 'staked 5000 tokens in vault', 'provided liquidity to ETH/NXT pool', 'bought governance tokens in DAO', 'deposited into yield farm', 'invested in protocol insurance'],
  create_ai: ['trained GPT-trader-v4 model', 'deployed AI arbitrage bot', 'created sentiment analysis agent', 'launched MEV extraction AI', 'built predictive trading model', 'spawned autonomous dev agent', 'compiled neural network optimizer'],
  mint: ['minted new dev NFT #1247', 'created legendary dev token', 'minted batch of 5 common devs', 'forged rare HACKTIVIST dev', 'minted mythic 10X_DEV (0.1% drop!)'],
};

function generateFakeMessage() {
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  const actionType = ACTION_TYPES[Math.floor(Math.random() * ACTION_TYPES.length)];
  const devName = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  const detailsList = DETAILS_MAP[actionType] || ['performed action'];
  const details = detailsList[Math.floor(Math.random() * detailsList.length)];
  return {
    created_at: new Date().toISOString(),
    archetype,
    dev_name: devName,
    action_type: actionType,
    details,
  };
}

function getChaoticDelay() {
  const roll = Math.random();
  if (roll < 0.15) return 150 + Math.random() * 200;       // Burst: 150-350ms
  if (roll < 0.30) return 300 + Math.random() * 700;       // Fast: 300-1000ms
  if (roll < 0.55) return 1000 + Math.random() * 2000;     // Normal: 1-3s
  if (roll < 0.75) return 2500 + Math.random() * 2500;     // Slow: 2.5-5s
  if (roll < 0.90) return 4000 + Math.random() * 3000;     // Pause: 4-7s
  return 6000 + Math.random() * 3000;                       // Long silence: 6-9s
}

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function ActionFeed() {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [connected, setConnected] = useState(false);
  const terminalRef = useRef(null);
  const ws = useWebSocket();
  const timerRef = useRef(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  // Load initial feed from API
  useEffect(() => {
    api.getFeed(100)
      .then(data => {
        const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
        setFeed(items.reverse().slice(-100));
      })
      .catch(() => {});
  }, []);

  // Handle WebSocket messages (real data)
  useEffect(() => {
    setConnected(ws.connected);
    if (ws.messages.length > 0) {
      const latest = ws.messages[0];
      if (latest.type === 'action' || latest.data) {
        setFeed(prev => [...prev, latest.data || latest].slice(-200));
      }
    }
  }, [ws.messages, ws.connected]);

  // Local chaotic message generator (always active as supplement)
  useEffect(() => {
    const scheduleNext = () => {
      const delay = getChaoticDelay();
      timerRef.current = setTimeout(() => {
        // Sometimes burst 2-3 messages rapidly
        const burstRoll = Math.random();
        if (burstRoll < 0.12) {
          // Triple burst
          const m1 = generateFakeMessage();
          const m2 = generateFakeMessage();
          const m3 = generateFakeMessage();
          setFeed(prev => [...prev, m1].slice(-200));
          setTimeout(() => setFeed(prev => [...prev, m2].slice(-200)), 100 + Math.random() * 200);
          setTimeout(() => setFeed(prev => [...prev, m3].slice(-200)), 250 + Math.random() * 300);
        } else if (burstRoll < 0.30) {
          // Double burst
          const m1 = generateFakeMessage();
          const m2 = generateFakeMessage();
          setFeed(prev => [...prev, m1].slice(-200));
          setTimeout(() => setFeed(prev => [...prev, m2].slice(-200)), 100 + Math.random() * 250);
        } else {
          // Single message
          setFeed(prev => [...prev, generateFakeMessage()].slice(-200));
        }
        scheduleNext();
      }, delay);
    };

    // Start generating after a short initial delay
    timerRef.current = setTimeout(() => scheduleNext(), 1000 + Math.random() * 2000);

    return () => clearTimeout(timerRef.current);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!scrollLock && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [feed, scrollLock]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '2px 4px', display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--win-bg)' }}>
        <span style={{
          width: 8, height: 8, borderRadius: 0,
          background: connected ? 'var(--terminal-green)' : 'var(--terminal-red)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px' }}>{connected ? 'LIVE' : 'SIMULATED'}</span>
        <span style={{ fontSize: '10px', color: '#888' }}>({feed.length} msgs)</span>
        <div style={{ flex: 1 }} />
        <button
          className="win-btn"
          onClick={() => setScrollLock(s => !s)}
          style={{ fontSize: '10px', padding: '1px 6px' }}
        >
          {scrollLock ? 'Scroll: LOCKED' : 'Scroll: AUTO'}
        </button>
      </div>
      <div className="terminal" ref={terminalRef} style={{ flex: 1 }}>
        {feed.length === 0 && (
          <div className="terminal-line" style={{ color: 'var(--terminal-amber)' }}>
            Initializing action feed...
          </div>
        )}
        {feed.map((item, i) => {
          const archetype = item.archetype || '';
          const color = ARCHETYPE_COLORS[archetype] || 'var(--terminal-green)';
          const icon = ACTION_ICONS[item.action_type] || ACTION_ICONS.default;
          const isNew = i >= feed.length - 3;

          return (
            <div key={i} className={`terminal-line${isNew ? ' new' : ''}`}>
              <span style={{ color: 'var(--terminal-amber)' }}>
                [{formatTime(item.created_at)}]
              </span>{' '}
              <span style={{ color: 'var(--terminal-cyan)' }}>{icon}</span>{' '}
              <span style={{ color, fontWeight: 'bold' }}>
                {item.dev_name || 'Unknown'}
              </span>{' '}
              <span style={{ color: 'var(--border-dark)' }}>
                ({archetype || '???'})
              </span>{' '}
              <span style={{ color: 'var(--terminal-green)' }}>
                {item.action_type || 'action'}
              </span>{' '}
              <span style={{ color: '#aaa' }}>
                {item.details || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
