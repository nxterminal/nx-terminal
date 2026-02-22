import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import StartMenu from './StartMenu';

export default function Taskbar({ windows, onWindowClick, openWindow, unreadCount = 0 }) {
  const [cycle, setCycle] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const { address, isConnected, isConnecting, connect, disconnect, displayAddress, connectError } = useWallet();
  const [walletError, setWalletError] = useState(null);
  const [assistantOn, setAssistantOn] = useState(
    () => localStorage.getItem('nx-assistant-enabled') !== 'false'
  );

  useEffect(() => {
    const fetchCycle = () => {
      api.getSimulationState()
        .then(data => setCycle(data.current_cycle || data.cycle || '?'))
        .catch(() => {});
    };
    fetchCycle();
    const id = setInterval(fetchCycle, 30000);
    return () => clearInterval(id);
  }, []);

  // Surface wagmi connect errors
  useEffect(() => {
    if (connectError) {
      if (connectError.name === 'UserRejectedRequestError') {
        setWalletError('Connection rejected. You must approve the wallet connection request to continue.');
      } else if (connectError.message?.includes('Connector not found')) {
        setWalletError('No wallet detected. Install MetaMask or a compatible wallet extension.');
      } else {
        setWalletError(connectError.shortMessage || connectError.message || 'Failed to connect wallet.');
      }
    }
  }, [connectError]);

  const handleWalletClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  // Sync assistant state when toggled from Settings
  useEffect(() => {
    const sync = () => setAssistantOn(localStorage.getItem('nx-assistant-enabled') !== 'false');
    window.addEventListener('nx-assistant-changed', sync);
    return () => window.removeEventListener('nx-assistant-changed', sync);
  }, []);

  const toggleAssistant = useCallback(() => {
    const next = !assistantOn;
    localStorage.setItem('nx-assistant-enabled', String(next));
    setAssistantOn(next);
    window.dispatchEvent(new Event('nx-assistant-changed'));
  }, [assistantOn]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <>
    {walletError && (
      <div style={{
        position: 'fixed',
        bottom: '42px',
        right: '8px',
        zIndex: 10002,
        background: 'var(--win-bg)',
        border: '2px solid var(--border-darker)',
        boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 var(--border-light), 3px 3px 8px rgba(0,0,0,0.4)',
        maxWidth: '320px',
        fontFamily: "'Tahoma', sans-serif",
      }}>
        <div style={{
          background: 'linear-gradient(90deg, var(--terminal-red), #cc0000)',
          color: 'white',
          padding: '2px 6px',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>[!] Wallet Error</span>
          <button
            onClick={() => setWalletError(null)}
            style={{
              background: 'var(--win-bg)',
              border: 'none',
              width: '16px',
              height: '14px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              boxShadow: 'inset -1px -1px 0 var(--border-darker), inset 1px 1px 0 var(--border-light)',
            }}
          >
            x
          </button>
        </div>
        <div style={{ padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', flexShrink: 0 }}>[X]</span>
          <div>
            <div style={{ fontSize: '11px', marginBottom: '10px', lineHeight: 1.4 }}>{walletError}</div>
            <button className="win-btn" onClick={() => setWalletError(null)} style={{ padding: '3px 20px', fontSize: '11px' }}>
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="taskbar">
      <StartMenu
        open={startOpen}
        onClose={() => setStartOpen(false)}
        openWindow={openWindow}
      />

      <button
        className={`win-btn start-btn${startOpen ? ' active' : ''}`}
        onClick={() => setStartOpen(s => !s)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }}>
          <rect x="1" y="1" width="6" height="6" rx="0.5" fill="#ff0000" stroke="#cc0000" strokeWidth="0.3"/>
          <rect x="9" y="1" width="6" height="6" rx="0.5" fill="#00aa00" stroke="#008800" strokeWidth="0.3"/>
          <rect x="1" y="9" width="6" height="6" rx="0.5" fill="#0055dd" stroke="#0044bb" strokeWidth="0.3"/>
          <rect x="9" y="9" width="6" height="6" rx="0.5" fill="#eecc00" stroke="#ccaa00" strokeWidth="0.3"/>
          <rect x="2" y="2" width="2" height="2" rx="0.3" fill="rgba(255,255,255,0.35)"/>
          <rect x="10" y="2" width="2" height="2" rx="0.3" fill="rgba(255,255,255,0.35)"/>
          <rect x="2" y="10" width="2" height="2" rx="0.3" fill="rgba(255,255,255,0.35)"/>
          <rect x="10" y="10" width="2" height="2" rx="0.3" fill="rgba(255,255,255,0.35)"/>
        </svg>
        <span style={{ fontWeight: 'bold', letterSpacing: '0.3px' }}>Start</span>
      </button>

      <button
        className="win-btn taskbar-wallet-btn"
        onClick={handleWalletClick}
        disabled={isConnecting}
        title={isConnected ? `${address} (click to disconnect)` : 'Connect Wallet'}
        style={isConnected ? { color: 'var(--terminal-green)' } : undefined}
      >
        {isConnected ? displayAddress : isConnecting ? 'Connecting...' : 'Connect'}
      </button>

      <div className="taskbar-divider" />

      <div className="taskbar-windows">
        {windows.map(w => (
          <button
            key={w.id}
            className={`win-btn taskbar-btn${!w.minimized ? ' active' : ''}`}
            onClick={() => onWindowClick(w.id)}
            title={w.title}
          >
            <span>{w.icon} {w.title}</span>
          </button>
        ))}
      </div>

      <div className="taskbar-tray">
        <button
          className="tray-icon"
          onClick={toggleAssistant}
          title={assistantOn ? 'Hide Assistant' : 'Show Assistant'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: assistantOn ? 1 : 0.4, display: 'block' }}>
            <path d="M8 1 C8 1 6 3 6 6 L6 8 C6 9 5 10 4 10 L3 10 C2 10 2 11 3 11 L6 11 C6 11 6 12 7 13 L9 13 C10 12 10 11 10 11 L13 11 C14 11 14 10 13 10 L12 10 C11 10 10 9 10 8 L10 6 C10 3 8 1 8 1Z" fill="#808080" stroke="#333" strokeWidth="0.6"/>
            <circle cx="8" cy="5" r="1" fill="#333"/>
          </svg>
        </button>

        <button
          className="tray-icon"
          onClick={() => openWindow('inbox')}
          title={unreadCount > 0 ? `${unreadCount} unread` : 'Inbox'}
          style={{ position: 'relative' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" style={{ display: 'block' }}>
            <rect x="1" y="4" width="14" height="9" rx="1" fill="#e8e8d8" stroke="#666" strokeWidth="0.7"/>
            <path d="M1 4 L8 9.5 L15 4" fill="none" stroke="#666" strokeWidth="0.7"/>
            <path d="M1.5 4.5 L8 9 L14.5 4.5" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2"/>
          </svg>
          {unreadCount > 0 && <span className="tray-badge" />}
        </button>

        <div className="taskbar-clock">
          <div style={{ fontSize: '10px', lineHeight: 1.1, textAlign: 'center' }}>
            <div>{timeStr}</div>
            <div style={{ fontSize: '9px', color: '#666' }}>Cycle: {cycle ?? '...'}</div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
