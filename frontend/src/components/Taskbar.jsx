import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWallet } from '../contexts/WalletContext';

export default function Taskbar({ windows, onWindowClick, onStartClick, startOpen }) {
  const [cycle, setCycle] = useState(null);
  const [time, setTime] = useState('');
  const { connected, truncated, connect } = useWallet();

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

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const id = setInterval(updateTime, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="taskbar">
      <button
        className={`win-btn start-btn${startOpen ? ' active' : ''}`}
        onClick={onStartClick}
      >
        <span style={{ fontSize: '14px' }}>&#x1F5A5;</span>
        <span style={{ fontWeight: 'bold' }}>Start</span>
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
          className="win-btn wallet-btn"
          onClick={connect}
          title={connected ? truncated : 'Connect Wallet'}
        >
          {connected ? `🔗 ${truncated}` : '🔗 Connect Wallet'}
        </button>
        <div className="taskbar-divider" />
        <div className="taskbar-clock" title={`Cycle: ${cycle ?? '...'}`}>
          <span>🔄 {cycle ?? '...'}</span>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}
