import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444', 'LURKER': '#808080', 'DEGEN': '#ffd700',
  'GRINDER': '#4488ff', 'INFLUENCER': '#ff44ff', 'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00', 'SCRIPT_KIDDIE': '#00ffff',
};

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function DevChat() {
  const [channel, setChannel] = useState('trollbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.getDevChat(channel)
      .then(d => {
        const msgs = Array.isArray(d) ? d : d.messages || [];
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channel]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(() => {
      api.getDevChat(channel)
        .then(d => {
          const msgs = Array.isArray(d) ? d : d.messages || [];
          setMessages(msgs);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [channel]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button className={`win-tab${channel === 'trollbox' ? ' active' : ''}`} onClick={() => setChannel('trollbox')}>
          Trollbox
        </button>
        <button className={`win-tab${channel === 'tech' ? ' active' : ''}`} onClick={() => setChannel('tech')}>
          Tech
        </button>
        <button className={`win-tab${channel === 'trading' ? ' active' : ''}`} onClick={() => setChannel('trading')}>
          Trading
        </button>
      </div>

      <div className="terminal" ref={terminalRef} style={{ flex: 1 }}>
        {loading ? (
          <div style={{ color: 'var(--terminal-amber)' }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--terminal-amber)' }}>No messages in #{channel} yet...</div>
        ) : (
          messages.map((msg, i) => {
            const color = ARCHETYPE_COLORS[msg.archetype] || 'var(--terminal-green)';
            return (
              <div key={i} className="terminal-line">
                <span style={{ color: 'var(--border-dark)' }}>
                  [{formatTime(msg.created_at)}]
                </span>{' '}
                <span style={{ color, fontWeight: 'bold' }}>
                  {msg.dev_name || 'Anon'}
                </span>
                <span style={{ color: 'var(--border-dark)' }}>
                  {msg.archetype ? ` (${msg.archetype})` : ''}
                </span>
                <span style={{ color: 'var(--terminal-green)' }}>
                  : {msg.message || msg.content}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
