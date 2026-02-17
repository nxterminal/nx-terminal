import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const MOCK_MESSAGES = [
  { display_name: '0x7a3f...2b1c', message: 'anyone know if Closed AI devs are worth it?', created_at: new Date(Date.now() - 300000).toISOString() },
  { display_name: '0x9e1d...4f8a', message: 'just minted 5 devs, Protocol Wars here I come', created_at: new Date(Date.now() - 240000).toISOString() },
  { display_name: '0x2c8b...7e3d', message: 'my dev NEXUS-7X is literally carrying my portfolio', created_at: new Date(Date.now() - 180000).toISOString() },
  { display_name: '0xf4a2...1d9e', message: 'how do I sabotage someone lmao', created_at: new Date(Date.now() - 120000).toISOString() },
  { display_name: '0x5b6c...8a2f', message: "day 3 and I'm already mass-producing protocols", created_at: new Date(Date.now() - 60000).toISOString() },
  { display_name: '0x3d9a...6c4e', message: 'Misanthropic devs have the best morale ngl', created_at: new Date(Date.now() - 30000).toISOString() },
  { display_name: '0x8f2e...5a7b', message: 'when does the next world event hit?', created_at: new Date(Date.now() - 15000).toISOString() },
];

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function WorldChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);
  const terminalRef = useRef(null);

  useEffect(() => {
    api.getWorldChat()
      .then(d => {
        const msgs = Array.isArray(d) ? d : d.messages || [];
        setMessages(msgs.length > 0 ? msgs : MOCK_MESSAGES);
      })
      .catch(() => {
        setMessages(MOCK_MESSAGES);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      api.getWorldChat()
        .then(d => {
          const msgs = Array.isArray(d) ? d : d.messages || [];
          if (msgs.length > 0) setMessages(msgs);
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

  const handleChatAttempt = () => {
    setWalletError(true);
    setTimeout(() => setWalletError(false), 5000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '6px 10px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-amber)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--border-dark)',
      }}>
        <span>{'\u26A0'} Wallet not connected — Chat is read-only</span>
        <button className="win-btn" onClick={handleChatAttempt} style={{ fontSize: '10px', padding: '2px 8px' }}>
          Connect Wallet
        </button>
      </div>

      {walletError && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-red)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>{'\u274C'}</span>
          <span style={{ color: 'var(--terminal-red)', fontFamily: "'VT323', monospace", fontSize: '14px' }}>
            ERROR: No wallet detected. Connect your wallet from the taskbar to send messages.
          </span>
        </div>
      )}

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
          onClick={handleChatAttempt}
          style={{
            flex: 1,
            padding: '2px 6px',
            fontFamily: "'Tahoma', sans-serif",
            fontSize: '11px',
            border: 'none',
            boxShadow: 'inset -1px -1px 0 var(--border-light), inset 1px 1px 0 var(--border-dark)',
            cursor: 'not-allowed',
          }}
        />
        <button className="win-btn" onClick={handleChatAttempt} style={{ fontSize: '10px' }}>Send</button>
      </div>
    </div>
  );
}
