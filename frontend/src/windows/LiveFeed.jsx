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
  code: '>>', trade: '$', chat: '#', hack: '!',
  create_protocol: '+', invest: '%', create_ai: '*', mint: '@',
  default: '>',
};

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function LiveFeed() {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [connected, setConnected] = useState(false);
  const terminalRef = useRef(null);
  const ws = useWebSocket();

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

  // Auto-scroll
  useEffect(() => {
    if (!scrollLock && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [feed, scrollLock]);

  const hasDevs = feed.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '2px 4px', display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--win-bg)' }}>
        <span style={{
          width: 8, height: 8, borderRadius: 0,
          background: connected ? 'var(--terminal-green)' : 'var(--terminal-red)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px' }}>{connected ? 'LIVE' : 'CONNECTING...'}</span>
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
        {!hasDevs && (
          <div style={{ color: 'var(--terminal-amber)', padding: '20px', textAlign: 'center' }}>
            No developers hired yet. Mint your first dev to see the action.
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
