import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const RARITY_COLORS = {
  common: '#c0c0c0', uncommon: '#33ff33', rare: '#4488ff',
  legendary: '#ffd700', mythic: '#ff44ff',
};

const MOVEMENT_ICONS = {
  salary: '+',
  sell: '+',
  spend: '-',
  claim: '\u2193',
  shop: '-',
};

const MOVEMENT_COLORS = {
  salary: '#33ff33',
  sell: '#33ff33',
  spend: '#ff4444',
  claim: '#ffaa00',
  shop: '#ff4444',
};

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Balance Tab ───────────────────────────────────────────
function BalanceTab({ summary, loading }) {
  if (loading) return <div className="loading">Loading wallet...</div>;
  if (!summary) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%',
    }}>
      {'> Connect wallet to view your $NXT balance'}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">Available</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>
            {formatNumber(summary.balance_claimable)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Claimed</div>
          <div className="stat-value" style={{ color: 'var(--terminal-green)' }}>
            {formatNumber(summary.balance_claimed)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: 'var(--terminal-cyan)' }}>
            {formatNumber(summary.balance_total_earned)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
      </div>

      {/* Salary info */}
      <div style={{
        padding: '4px 8px', margin: '0 8px',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-green)', background: 'var(--terminal-bg)',
      }}>
        {'>'} Salary: <span style={{ color: 'var(--gold)' }}>200 $NXT/day</span> per dev
        {' \u00D7 '}{summary.total_devs} devs = <span style={{ color: 'var(--gold)' }}>{formatNumber(summary.salary_per_day)} $NXT/day</span>
      </div>

      {/* Claim button */}
      <div style={{ padding: '8px', textAlign: 'center' }}>
        <button
          className="win-btn"
          disabled={!summary.balance_claimable || summary.balance_claimable <= 0}
          style={{
            padding: '6px 24px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: summary.balance_claimable > 0 ? '#000' : undefined,
          }}
        >
          CLAIM {formatNumber(summary.balance_claimable)} $NXT
        </button>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
          You receive the full amount. No hidden fees.
        </div>
      </div>

      {/* Per-dev breakdown */}
      <div className="win-panel" style={{ flex: 1, overflow: 'auto', margin: '0 4px 4px' }}>
        <table className="win-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Rarity</th>
              <th>Balance</th>
              <th>Earned</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(summary.devs || []).map(dev => (
              <tr key={dev.token_id}>
                <td>#{dev.token_id}</td>
                <td style={{ fontWeight: 'bold' }}>{dev.name}</td>
                <td>
                  <span style={{ color: RARITY_COLORS[dev.rarity_tier] || '#c0c0c0' }}>
                    {dev.rarity_tier}
                  </span>
                </td>
                <td style={{ color: 'var(--gold)' }}>{formatNumber(dev.balance_nxt)}</td>
                <td>{formatNumber(dev.total_earned)}</td>
                <td>{dev.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chart Tab ─────────────────────────────────────────────
function ChartTab({ history, loading }) {
  if (loading) return <div className="loading">Loading chart...</div>;
  if (!history || history.length === 0) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%',
    }}>
      {'> No balance history yet. Snapshots are recorded daily.'}
    </div>
  );

  const data = history.map(s => ({
    date: formatDate(s.snapshot_date),
    claimable: Number(s.balance_claimable),
    earned: Number(s.balance_total_earned),
  }));

  const firstVal = data[0]?.claimable || 0;
  const lastVal = data[data.length - 1]?.claimable || 0;
  const trend = lastVal >= firstVal ? 'up' : 'down';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px', padding: '4px 8px',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        background: 'var(--terminal-bg)',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>{'>'} Balance History (30 days)</span>
        <span style={{ color: trend === 'up' ? 'var(--terminal-green)' : 'var(--terminal-red)' }}>
          {trend === 'up' ? '\u25B2' : '\u25BC'} {formatNumber(Math.abs(lastVal - firstVal))} $NXT
        </span>
      </div>

      <div className="win-panel" style={{ flex: 1, padding: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date" tick={{ fontSize: 10, fill: '#888' }}
              stroke="#555"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#888' }}
              stroke="#555"
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a', border: '1px solid #555',
                fontFamily: "'VT323', monospace", fontSize: '13px',
                color: '#fff',
              }}
              formatter={(value, name) => [
                `${formatNumber(value)} $NXT`,
                name === 'claimable' ? 'Available' : 'Total Earned',
              ]}
            />
            <Line
              type="monotone" dataKey="claimable" name="claimable"
              stroke="#ffd700" strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: '#ffd700' }}
            />
            <Line
              type="monotone" dataKey="earned" name="earned"
              stroke="#33ff33" strokeWidth={1} dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 3, fill: '#33ff33' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px', fontSize: '10px' }}>
        <span><span style={{ color: '#ffd700' }}>{'\u2501\u2501'}</span> Available</span>
        <span><span style={{ color: '#33ff33' }}>{'- -'}</span> Total Earned</span>
      </div>
    </div>
  );
}

// ── Movements Tab ─────────────────────────────────────────
function MovementsTab({ movements, loading }) {
  if (loading) return <div className="loading">Loading movements...</div>;
  if (!movements || movements.length === 0) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%',
    }}>
      {'> No movements recorded yet.'}
    </div>
  );

  return (
    <div className="win-panel" style={{ height: '100%', overflow: 'auto' }}>
      <table className="win-table">
        <thead>
          <tr>
            <th style={{ width: '24px' }}></th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Dev</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m, i) => (
            <tr key={i}>
              <td style={{
                color: MOVEMENT_COLORS[m.type] || '#888',
                fontWeight: 'bold', textAlign: 'center', fontSize: '13px',
              }}>
                {MOVEMENT_ICONS[m.type] || '?'}
              </td>
              <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                {m.type}
              </td>
              <td style={{ fontSize: '10px', whiteSpace: 'normal' }}>
                {m.description}
              </td>
              <td style={{
                color: m.amount >= 0 ? 'var(--terminal-green)' : 'var(--terminal-red)',
                fontWeight: 'bold',
              }}>
                {m.amount >= 0 ? '+' : ''}{formatNumber(m.amount)} $NXT
              </td>
              <td style={{ fontSize: '10px' }}>
                {m.dev_name || (m.dev_id ? `#${m.dev_id}` : '-')}
              </td>
              <td style={{ fontSize: '10px' }}>
                {formatTimestamp(m.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function NxtWallet() {
  const [tab, setTab] = useState('balance');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);

  // TODO: Replace with actual connected wallet address
  const wallet = null;

  useEffect(() => {
    if (!wallet) {
      setLoadingSummary(false);
      setLoadingHistory(false);
      setLoadingMovements(false);
      return;
    }

    api.getWalletSummary(wallet)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoadingSummary(false));

    api.getBalanceHistory(wallet)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));

    api.getMovements(wallet)
      .then(setMovements)
      .catch(() => {})
      .finally(() => setLoadingMovements(false));
  }, [wallet]);

  const tabs = [
    { id: 'balance', label: 'Balance' },
    { id: 'chart', label: 'Chart' },
    { id: 'movements', label: 'Movements' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div className="win-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`win-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'balance' && <BalanceTab summary={summary} loading={loadingSummary} />}
        {tab === 'chart' && <ChartTab history={history} loading={loadingHistory} />}
        {tab === 'movements' && <MovementsTab movements={movements} loading={loadingMovements} />}
      </div>

      {/* Status bar */}
      <div className="win98-statusbar" style={{ fontSize: '10px', color: '#555' }}>
        {wallet
          ? `${wallet.slice(0, 6)}...${wallet.slice(-4)} | Salary: 200 $NXT/day per dev`
          : 'Wallet not connected'
        }
      </div>
    </div>
  );
}
