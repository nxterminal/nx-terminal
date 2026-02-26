import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function WorldChat() {
  const { address, isConnected, isConnecting, connect, displayAddress } = useWallet();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    api.getWorldChat()
      .then(d => {
        const msgs = Array.isArray(d) ? d : d.messages || [];
        setMessages(msgs);
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      api.getWorldChat()
        .then(d => {
          const msgs = Array.isArray(d) ? d : d.messages || [];
          setMessages(msgs);
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

  const sendMessage = async () => {
    if (!address || !inputValue.trim() || sending) return;
    setSending(true);
    try {
      await api.postWorldChat(address, displayAddress, inputValue.trim());
      setInputValue('');
      const d = await api.getWorldChat();
      const msgs = Array.isArray(d) ? d : d.messages || [];
      setMessages(msgs);
    } catch {
      setError('Failed to send message. Try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
        {isConnected ? (
          <span style={{ color: 'var(--terminal-green)' }}>
            Connected: {displayAddress}
          </span>
        ) : (
          <>
            <span>[!] Wallet not connected -- Chat is read-only</span>
            <button
              className="win-btn"
              onClick={connect}
              disabled={isConnecting}
              style={{ fontSize: '10px', padding: '2px 8px' }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-red)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '14px', fontFamily: "'VT323', monospace" }}>[X]</span>
          <span style={{ color: 'var(--terminal-red)', fontFamily: "'VT323', monospace", fontSize: '14px' }}>
            ERROR: {error}
          </span>
        </div>
      )}

      <div className="terminal" ref={terminalRef} style={{ flex: 1 }}>
        {loading ? (
          <div style={{ color: 'var(--terminal-amber)' }}>Loading world chat...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--terminal-amber)', padding: '8px' }}>
            No messages yet. {isConnected ? 'Be the first to say something.' : 'Connect your wallet to start chatting.'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className="terminal-line">
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
          placeholder={isConnected ? 'Type a message...' : 'Connect wallet to chat...'}
          disabled={!isConnected || sending}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={280}
          style={{
            flex: 1,
            padding: '2px 6px',
            fontFamily: "'Tahoma', sans-serif",
            fontSize: '11px',
            border: 'none',
            boxShadow: 'inset -1px -1px 0 var(--border-light), inset 1px 1px 0 var(--border-dark)',
            cursor: isConnected ? 'text' : 'not-allowed',
          }}
        />
        <button
          className="win-btn"
          onClick={sendMessage}
          disabled={!isConnected || !inputValue.trim() || sending}
          style={{ fontSize: '10px' }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
