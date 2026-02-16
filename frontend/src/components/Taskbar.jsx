import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import StartMenu from './StartMenu';

export default function Taskbar({ windows, onWindowClick, openWindow }) {
  const [cycle, setCycle] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);

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
      alert('MetaMask not detected. Install MetaMask to connect your wallet.');
      return;
    }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch {
      // User rejected or error
    } finally {
      setConnecting(false);
    }
  }, [walletAddress]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
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
        <span style={{ fontSize: '14px' }}>&#x1F5A5;</span>
        <span>Start</span>
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
        {walletAddress ? formatAddress(walletAddress) : connecting ? 'Connecting...' : '\u{1F4B0} Connect'}
      </button>

      <div className="taskbar-clock">
        <div style={{ fontSize: '10px', lineHeight: 1.1, textAlign: 'center' }}>
          <div>{timeStr}</div>
          <div style={{ fontSize: '9px', color: '#666' }}>Cycle: {cycle ?? '...'}</div>
        </div>
      </div>
    </div>
  );
}
