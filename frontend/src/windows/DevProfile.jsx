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
    <div className="energy-bar">
      <div className={`energy-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function DevProfile({ devId }) {
  const [dev, setDev] = useState(null);
  const [tab, setTab] = useState('history');
  const [tabData, setTabData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (!devId) return;
    setLoading(true);
    api.getDev(devId)
      .then(d => setDev(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [devId]);

  useEffect(() => {
    if (!devId) return;
    setTabLoading(true);
    const fetchers = {
      history: () => api.getDevHistory(devId),
      protocols: () => api.getDevProtocols(devId),
      ais: () => api.getDevAIs(devId),
      investments: () => api.getDevInvestments(devId),
      messages: () => api.getDevMessages(devId),
    };
    (fetchers[tab] || fetchers.history)()
      .then(d => setTabData(Array.isArray(d) ? d : d[tab] || d.data || []))
      .catch(() => setTabData([]))
      .finally(() => setTabLoading(false));
  }, [devId, tab]);

  if (loading) return <div className="loading">Loading dev profile...</div>;
  if (!dev) return <div className="error-msg">Dev not found</div>;

  const arcColor = ARCHETYPE_COLORS[dev.archetype] || '#ccc';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '8px', borderBottom: '2px solid var(--border-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{dev.name}</span>
          <span className={`badge badge-${dev.archetype}`} style={{ color: arcColor }}>
            {dev.archetype}
          </span>
          {dev.rarity && (
            <span className={`rarity-${dev.rarity}`} style={{ fontSize: '10px' }}>
              [{dev.rarity.toUpperCase()}]
            </span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: '#666' }}>
          {dev.corporation && <span>Corp: {dev.corporation} | </span>}
          Token #{dev.token_id || devId}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-box win-panel">
          <div className="stat-label">Energy</div>
          <EnergyBar energy={dev.energy} />
          <div style={{ fontSize: '10px', marginTop: '2px' }}>{dev.energy ?? 0}/100</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Balance</div>
          <div className="stat-value" style={{ color: 'var(--gold)', fontSize: '13px' }}>
            {formatNumber(dev.balance_nxt || dev.balance)} $NXT
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Reputation</div>
          <div className="stat-value" style={{ fontSize: '13px' }}>{formatNumber(dev.reputation)}</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Mood</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>{dev.mood || '?'}</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Location</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>{dev.location || '?'}</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Level</div>
          <div className="stat-value" style={{ fontSize: '13px' }}>{dev.level || '?'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="win-tabs">
        {['history', 'protocols', 'ais', 'investments', 'messages'].map(t => (
          <button key={t} className={`win-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tabLoading ? (
          <div className="loading">Loading...</div>
        ) : tab === 'history' ? (
          <div className="terminal" style={{ minHeight: 100 }}>
            {tabData.length === 0 && <div style={{ color: 'var(--terminal-amber)' }}>No history yet</div>}
            {tabData.map((item, i) => (
              <div key={i} className="terminal-line">
                <span style={{ color: 'var(--terminal-amber)' }}>[{formatTime(item.created_at)}]</span>{' '}
                <span style={{ color: 'var(--terminal-cyan)' }}>{item.action_type}</span>{' '}
                <span>{item.details || ''}</span>
              </div>
            ))}
          </div>
        ) : tab === 'messages' ? (
          <div className="terminal" style={{ minHeight: 100 }}>
            {tabData.length === 0 && <div style={{ color: 'var(--terminal-amber)' }}>No messages yet</div>}
            {tabData.map((msg, i) => (
              <div key={i} className="terminal-line">
                <span style={{ color: 'var(--border-dark)' }}>[{formatTime(msg.created_at)}]</span>{' '}
                <span style={{ color: 'var(--terminal-green)' }}>{msg.message || msg.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <table className="win-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>{tab === 'investments' ? 'Amount' : 'Info'}</th>
              </tr>
            </thead>
            <tbody>
              {tabData.length === 0 && (
                <tr><td colSpan="2" style={{ textAlign: 'center', color: '#999' }}>None yet</td></tr>
              )}
              {tabData.map((item, i) => (
                <tr key={i}>
                  <td>{item.name || item.protocol_name || `Item ${i + 1}`}</td>
                  <td>
                    {tab === 'investments'
                      ? `${formatNumber(item.amount)} $NXT`
                      : item.description || item.value || '-'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
