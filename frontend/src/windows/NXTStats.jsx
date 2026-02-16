import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function NXTStats() {
  const [tab, setTab] = useState('corp');
  const [corpData, setCorpData] = useState([]);
  const [devData, setDevData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'corp') {
      api.getCorpLeaderboard()
        .then(d => setCorpData(Array.isArray(d) ? d : d.corporations || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api.getDevs({ limit: 20, sort: 'balance' })
        .then(d => setDevData(Array.isArray(d) ? d : d.devs || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const maxCorpBalance = corpData.reduce((max, c) => Math.max(max, c.total_balance || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button className={`win-tab${tab === 'corp' ? ' active' : ''}`} onClick={() => setTab('corp')}>
          By Corporation
        </button>
        <button className={`win-tab${tab === 'user' ? ' active' : ''}`} onClick={() => setTab('user')}>
          By User (My Devs)
        </button>
      </div>

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div className="loading">Loading stats...</div>
        ) : tab === 'corp' ? (
          <table className="win-table">
            <thead>
              <tr>
                <th>Corporation</th>
                <th>Total $NXT</th>
                <th>Employees</th>
                <th>Avg/Emp</th>
                <th style={{ width: '120px' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {corpData.map((c, i) => {
                const balance = c.total_balance || 0;
                const devs = c.total_devs || c.dev_count || 1;
                const avg = Math.round(balance / devs);
                const pct = Math.round((balance / maxCorpBalance) * 100);
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{c.corporation || c.name}</td>
                    <td style={{ color: 'var(--gold)' }}>{formatNumber(balance)}</td>
                    <td>{devs}</td>
                    <td>{formatNumber(avg)}</td>
                    <td>
                      <div style={{
                        width: '100%',
                        height: '10px',
                        background: '#000',
                        border: '1px solid var(--border-dark)',
                      }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'var(--terminal-green)',
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <>
            <table className="win-table">
              <thead>
                <tr><th>Dev</th><th>Salary</th><th>Trading</th><th>AI Lab</th><th>Total</th></tr>
              </thead>
              <tbody>
                {devData.map((d, i) => {
                  const total = d.balance_nxt || d.balance || 0;
                  const salary = Math.round(total * 0.6);
                  const trading = Math.round(total * 0.3);
                  const aiLab = total - salary - trading;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>{d.name}</td>
                      <td>{formatNumber(salary)}</td>
                      <td>{formatNumber(trading)}</td>
                      <td>{formatNumber(aiLab)}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{formatNumber(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{
              padding: '8px',
              fontSize: '11px',
              color: '#666',
              fontStyle: 'italic',
              borderTop: '1px solid var(--border-dark)',
            }}>
              HR Recommendation: Diversify your dev team across archetypes for optimal $NXT generation.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
