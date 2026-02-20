import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

export default function Taskbar({ windows, onWindowClick, onOpenWindow }) {
  const [cycle, setCycle] = useState(null);
  const { address, shortAddress, isConnected, isConnecting, wrongChain, balance, connectWallet, disconnect } = useWallet();

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

  return (
    <div className="taskbar">
      <button className="win-btn start-btn">
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

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isConnected ? (
          <>
            {wrongChain && (
              <div style={{
                background: '#ff4444', color: '#fff', padding: '2px 6px',
                fontSize: '10px', fontFamily: 'Fixedsys, Consolas, monospace',
              }}>
                Wrong Network!
              </div>
            )}
            <button
              className="win-btn"
              onClick={() => onOpenWindow && onOpenWindow('mint-devs')}
              style={{
                background: '#004400', color: '#00ff41', border: '2px outset #00ff41',
                padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
                fontFamily: 'Fixedsys, Consolas, monospace',
              }}
            >
              ⚡ MINT
            </button>
            <button
              className="win-btn"
              onClick={disconnect}
              title={`${address}\n${balance}`}
              style={{
                padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
                fontFamily: 'Fixedsys, Consolas, monospace',
                color: '#00ff41', background: '#0a0a0a', border: '2px inset #444',
              }}
            >
              {shortAddress} ({balance})
            </button>
          </>
        ) : (
          <button
            className="win-btn"
            onClick={connectWallet}
            disabled={isConnecting}
            style={{
              padding: '2px 10px', fontSize: '11px', cursor: 'pointer',
              fontFamily: 'Fixedsys, Consolas, monospace',
              color: '#000', background: isConnecting ? '#888' : '#00ff41',
              border: '2px outset #00ff41', fontWeight: 'bold',
            }}
          >
            {isConnecting ? '...' : '🔌 Connect'}
          </button>
        )}

        <div className="taskbar-clock">
          Cycle: {cycle ?? '...'}
        </div>
      </div>
    </div>
  );
}
