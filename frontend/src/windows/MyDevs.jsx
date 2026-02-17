import { useState, useEffect } from 'react';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444', 'LURKER': '#808080', 'DEGEN': '#ffd700',
  'GRINDER': '#4488ff', 'INFLUENCER': '#ff44ff', 'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00', 'SCRIPT_KIDDIE': '#00ffff',
};

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function EnergyBar({ energy }) {
  const pct = Math.max(0, Math.min(100, energy || 0));
  const cls = pct > 60 ? 'energy-high' : pct > 30 ? 'energy-mid' : 'energy-low';
  return (
    <div className="energy-bar" style={{ width: '60px', display: 'inline-block' }}>
      <div className={`energy-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MyDevs({ openDevProfile }) {
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  useEffect(() => {
    api.getDevs({ limit: 50, sort: 'balance' })
      .then(d => {
        setDevs(Array.isArray(d) ? d : d.devs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletError(true);
      setTimeout(() => setWalletError(false), 5000);
      return;
    }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletError(false);
    } catch {
      setWalletError(true);
      setTimeout(() => setWalletError(false), 5000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '6px 8px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-amber)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>[!] Wallet not connected. Showing all devs as preview...</span>
        <button className="win-btn" onClick={connectWallet} style={{ fontSize: '10px', padding: '2px 8px', flexShrink: 0 }}>
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
          <span style={{ fontSize: '14px', fontFamily: "'VT323', monospace" }}>[X]</span>
          <span style={{ color: 'var(--terminal-red)', fontFamily: "'VT323', monospace", fontSize: '14px' }}>
            ERROR: No wallet detected. Connect your wallet from the taskbar to view your developers.
          </span>
        </div>
      )}

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div className="loading">Loading devs...</div>
        ) : (
          <table className="win-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Archetype</th>
                <th>Energy</th>
                <th>Balance</th>
                <th>Mood</th>
              </tr>
            </thead>
            <tbody>
              {devs.map((dev) => (
                <tr
                  key={dev.token_id || dev.id}
                  className="clickable"
                  onClick={() => openDevProfile?.(dev.token_id || dev.id)}
                >
                  <td>#{dev.token_id || dev.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{dev.name}</td>
                  <td>
                    <span
                      className={`badge badge-${dev.archetype}`}
                      style={{ color: ARCHETYPE_COLORS[dev.archetype] }}
                    >
                      {dev.archetype}
                    </span>
                  </td>
                  <td><EnergyBar energy={dev.energy} /></td>
                  <td style={{ color: 'var(--gold)' }}>
                    {formatNumber(dev.balance_nxt || dev.balance)} $NXT
                  </td>
                  <td>{dev.mood || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
