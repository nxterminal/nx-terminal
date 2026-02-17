import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import StartMenu from './StartMenu';

export default function Taskbar({ windows, onWindowClick, openWindow, unreadCount = 0 }) {
  const [cycle, setCycle] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
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

  const connectWallet = useCallback(async () => {
    if (walletAddress) return;
    if (!window.ethereum) {
      setWalletError('MetaMask not detected. Install MetaMask or a compatible wallet extension to connect.');
      return;
    }
    setConnecting(true);
    setWalletError(null);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (err) {
      if (err.code === 4001) {
        setWalletError('Connection rejected. You must approve the wallet connection request to continue.');
      } else {
        setWalletError('Failed to connect wallet. Please try again or check your wallet extension.');
      }
    } finally {
      setConnecting(false);
    }
  }, [walletAddress]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
        bottom: '40px',
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
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>NX</span>
        <span>Start</span>
      </button>

      <button
        className="win-btn"
        onClick={connectWallet}
        disabled={connecting}
        style={{
          fontSize: '10px',
          padding: '2px 8px',
          flexShrink: 0,
          color: walletAddress ? 'var(--terminal-green)' : undefined,
        }}
        title={walletAddress || 'Connect Wallet'}
      >
        {walletAddress ? formatAddress(walletAddress) : connecting ? 'Connecting...' : 'Connect'}
      </button>

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
          <span style={{ opacity: assistantOn ? 1 : 0.4, fontSize: '11px' }}>[A]</span>
        </button>

        <button
          className="tray-icon"
          onClick={() => openWindow('inbox')}
          title={unreadCount > 0 ? `${unreadCount} unread` : 'Inbox'}
        >
          <span style={{ fontSize: '11px' }}>M</span>
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
