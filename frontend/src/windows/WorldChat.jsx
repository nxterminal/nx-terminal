import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function WorldChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => {
    api.getWorldChat()
      .then(d => {
        setMessages(Array.isArray(d) ? d : d.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      api.getWorldChat()
        .then(d => {
          setMessages(Array.isArray(d) ? d : d.messages || []);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="terminal" ref={terminalRef} style={{ flex: 1 }}>
        {loading ? (
          <div style={{ color: 'var(--terminal-amber)' }}>Loading world chat...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--terminal-amber)' }}>No messages yet. Be the first to say something!</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="terminal-line">
              <span style={{ color: 'var(--border-dark)' }}>
                [{formatTime(msg.created_at)}]
              </span>{' '}
              <span style={{ color: 'var(--terminal-cyan)', fontWeight: 'bold' }}>
                {msg.display_name || msg.username || 'Anon'}
              </span>
              <span style={{ color: 'var(--terminal-green)' }}>
                : {msg.message || msg.content}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{
        padding: '4px',
        borderTop: '2px solid var(--border-dark)',
        background: 'var(--win-bg)',
        display: 'flex',
        gap: '4px',
      }}>
        <input
          type="text"
          placeholder="Connect wallet to chat..."
          disabled
          style={{
            flex: 1,
            padding: '2px 6px',
            fontFamily: "'Tahoma', sans-serif",
            fontSize: '11px',
            border: 'none',
            boxShadow: 'inset -1px -1px 0 var(--border-light), inset 1px 1px 0 var(--border-dark)',
          }}
        />
        <button className="win-btn" disabled style={{ fontSize: '10px' }}>Send</button>
      </div>
    </div>
  );
}
