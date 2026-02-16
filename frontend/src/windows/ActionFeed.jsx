import { useState, useEffect, useRef } from 'react';
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
  code: '>>',
  trade: '$',
  chat: '#',
  hack: '!',
  create_protocol: '+',
  invest: '%',
  create_ai: '*',
  mint: '@',
  default: '>',
};

const CORPS = ['CLOSED AI', 'MISANTHROPIC', 'SHALLOW MIND', 'ZUCK LABS', 'Y.AI', 'MISTRIAL SYSTEMS'];
const DEV_PREFIXES = ['NEXUS', 'VOID', 'CIPHER', 'ECHO', 'DRIFT', 'FLUX', 'NANO', 'PULSE', 'CORE', 'GHOST', 'SHADE', 'BYTE'];
const DEV_SUFFIXES = ['7X', '9K', '3Z', '1A', '0x', '8B', '4R', '2W', '5N', '6Q'];
const ARCHETYPES = Object.keys(ARCHETYPE_COLORS);

const FEED_TEMPLATES = [
  { type: 'code', msgs: ['deployed mass-produced protocol v{n}', 'pushed {n} commits to main', 'refactored {n} legacy modules', 'wrote {n} lines of spaghetti code'] },
  { type: 'trade', msgs: ['bought {n} $NXT at market price', 'sold {n} protocol tokens', 'leveraged {n}x on $NXT futures', 'rug-checked {corp} token'] },
  { type: 'chat', msgs: ['posted in trollbox: "gm"', 'argued about tabs vs spaces for {n} min', 'started a flame war in #{corp}', 'sent {n} memos to management'] },
  { type: 'hack', msgs: ['found XSS in {corp} protocol', 'patched {n} critical vulnerabilities', 'exploited {corp} smart contract for {n} $NXT', 'ran penetration test on {corp} firewall'] },
  { type: 'create_protocol', msgs: ['launched "{corp} DeFi v{n}"', 'forked {corp} protocol (again)', 'created mass-produced NFT collection #{n}'] },
  { type: 'invest', msgs: ['invested {n} $NXT in {corp} protocol', 'bought {n} shares of {corp}', 'staked {n} $NXT in yield farm'] },
  { type: 'create_ai', msgs: ['trained AI model "CatGPT-{n}"', 'deployed bot #{n} to trollbox', 'created AI that generates other AIs'] },
  { type: 'mint', msgs: ['minted dev #{n} for {corp}', 'hired {n} new devs', 'onboarded batch #{n}'] },
];

function generateFeedItem() {
  const template = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)];
  const msg = template.msgs[Math.floor(Math.random() * template.msgs.length)];
  const corp = CORPS[Math.floor(Math.random() * CORPS.length)];
  const n = Math.floor(Math.random() * 999) + 1;
  const prefix = DEV_PREFIXES[Math.floor(Math.random() * DEV_PREFIXES.length)];
  const suffix = DEV_SUFFIXES[Math.floor(Math.random() * DEV_SUFFIXES.length)];
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

  return {
    dev_name: `${prefix}-${suffix}`,
    archetype,
    action_type: template.type,
    details: msg.replace('{n}', n).replace('{corp}', corp),
    created_at: new Date().toISOString(),
  };
}

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function ActionFeed({ hasMinted }) {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [connected, setConnected] = useState(false);
  const terminalRef = useRef(null);
  const ws = useWebSocket();
  const genRef = useRef(null);

  // Load initial feed
  useEffect(() => {
    api.getFeed(100)
      .then(data => {
        const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
        setFeed(items.reverse());
      })
      .catch(() => {});
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    setConnected(ws.connected);
    if (ws.messages.length > 0) {
      const latest = ws.messages[0];
      if (latest.type === 'action' || latest.data) {
        setFeed(prev => [...prev, latest.data || latest].slice(-200));
      }
    }
  }, [ws.messages, ws.connected]);

  // Client-side feed generation (always active for demo)
  useEffect(() => {
    const addGenerated = () => {
      setFeed(prev => [...prev, generateFeedItem()].slice(-200));
    };
    // Start with a burst of 5 items
    for (let i = 0; i < 5; i++) {
      setFeed(prev => [...prev, generateFeedItem()].slice(-200));
    }
    const interval = 3000 + Math.random() * 2000; // 3-5s
    genRef.current = setInterval(addGenerated, interval);
    return () => clearInterval(genRef.current);
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
          background: connected ? 'var(--terminal-green)' : 'var(--terminal-green)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px' }}>LIVE</span>
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
            Waiting for actions...
          </div>
        )}
        {feed.map((item, i) => {
          const archetype = item.archetype || '';
          const color = ARCHETYPE_COLORS[archetype] || 'var(--terminal-green)';
          const icon = ACTION_ICONS[item.action_type] || ACTION_ICONS.default;
          const isNew = i === feed.length - 1;

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
