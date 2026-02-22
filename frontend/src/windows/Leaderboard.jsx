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

function EmptyState({ message }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '12px', padding: '24px',
    }}>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: '24px', color: 'var(--text-muted, #555)' }}>[#]</div>
      <div style={{ fontWeight: 'bold', fontSize: '13px', textAlign: 'center', color: 'var(--text-primary, #000)' }}>
        Leaderboard is empty
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center', maxWidth: '280px' }}>
        {message}
      </div>
    </div>
  );
}

export default function Leaderboard({ openDevProfile }) {
  const [tab, setTab] = useState('balance');
  const [data, setData] = useState([]);
  const [corpData, setCorpData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'corporations') {
      api.getCorpLeaderboard()
        .then(d => { setCorpData(Array.isArray(d) ? d : d.corporations || []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api.getLeaderboard(tab)
        .then(d => { setData(Array.isArray(d) ? d : d.leaderboard || []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      if (tab === 'corporations') {
        api.getCorpLeaderboard()
          .then(d => setCorpData(Array.isArray(d) ? d : d.corporations || []))
          .catch(() => {});
      } else {
        api.getLeaderboard(tab)
          .then(d => setData(Array.isArray(d) ? d : d.leaderboard || []))
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(id);
  }, [tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button className={`win-tab${tab === 'balance' ? ' active' : ''}`} onClick={() => setTab('balance')}>By Balance</button>
        <button className={`win-tab${tab === 'reputation' ? ' active' : ''}`} onClick={() => setTab('reputation')}>By Reputation</button>
        <button className={`win-tab${tab === 'corporations' ? ' active' : ''}`} onClick={() => setTab('corporations')}>Corporations</button>
      </div>

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div className="loading">Loading leaderboard...</div>
        ) : tab === 'corporations' ? (
          corpData.length === 0 ? (
            <EmptyState message="No corporations have been formed yet. Mint devs to see the corporate hierarchy." />
          ) : (
            <table className="win-table">
              <thead>
                <tr><th>#</th><th>Corporation</th><th>Devs</th><th>Total Balance</th></tr>
              </thead>
              <tbody>
                {corpData.map((c, i) => (
                  <tr key={i}>
                    <td style={{ color: i < 3 ? 'var(--gold)' : undefined, fontWeight: i < 3 ? 'bold' : undefined }}>{i + 1}</td>
                    <td>{c.corporation || c.name}</td>
                    <td>{c.total_devs || c.dev_count}</td>
                    <td>{formatNumber(c.total_balance)} $NXT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : data.length === 0 ? (
          <EmptyState message="No devs on the leaderboard yet. Mint your first developer and watch them climb the ranks." />
        ) : (
          <table className="win-table">
            <thead>
              <tr><th>#</th><th>Name</th><th>Archetype</th><th>Corporation</th><th>{tab === 'balance' ? 'Balance' : 'Reputation'}</th></tr>
            </thead>
            <tbody>
              {data.map((dev, i) => (
                <tr
                  key={dev.token_id || i}
                  className="clickable"
                  onClick={() => openDevProfile?.(dev.token_id || dev.id)}
                >
                  <td style={{ color: i < 3 ? 'var(--gold)' : undefined, fontWeight: i < 3 ? 'bold' : undefined }}>
                    {dev.rank_balance || dev.rank_reputation || i + 1}
                  </td>
                  <td>{dev.name}</td>
                  <td>
                    <span className={`badge badge-${dev.archetype}`}>{dev.archetype}</span>
                  </td>
                  <td>{dev.corporation || '-'}</td>
                  <td>
                    {tab === 'balance'
                      ? `${formatNumber(dev.balance_nxt || dev.balance)} $NXT`
                      : formatNumber(dev.reputation)
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
