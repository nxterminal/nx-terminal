import { useEffect, useState } from 'react';
import { api } from '../../services/api';


const MEDALS = { 1: '\u{1F947}', 2: '\u{1F948}', 3: '\u{1F949}' };


function shortAddr(addr) {
  if (!addr) return '?';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}


function NetProfitCell({ value }) {
  let color = '#777';
  let sign = '';
  if (value > 0) { color = '#1e8449'; sign = '+'; }
  else if (value < 0) { color = '#a93226'; }
  return (
    <span style={{ color, fontWeight: 'bold' }}>
      {sign}{value.toLocaleString()} $NXT
    </span>
  );
}


function Toggle({ active, onChange }) {
  const btn = (id, label) => (
    <button
      key={id}
      onClick={() => onChange(id)}
      className="win-btn"
      style={{
        padding: '4px 14px', fontSize: 12,
        fontWeight: active === id ? 'bold' : 'normal',
        background: active === id ? '#fff' : undefined,
        borderBottom: active === id ? '2px solid #000080' : undefined,
        fontFamily: 'Tahoma, sans-serif',
      }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
      {btn('all', 'All-time')}
      {btn('30d', 'Last 30d')}
    </div>
  );
}


function RankBadge({ rank }) {
  const medal = MEDALS[rank];
  if (medal) {
    return (
      <span style={{
        fontSize: 16, display: 'inline-block', width: 24, textAlign: 'center',
      }}>{medal}</span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', width: 24, textAlign: 'center',
      color: '#555', fontWeight: 'bold', fontSize: 12,
    }}>{rank}</span>
  );
}


export default function Leaderboard({ wallet }) {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getLeaderboard(period, 25)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load leaderboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const rows = data?.leaderboard || [];
  const totalUsers = data?.total_users ?? 0;
  const me = wallet ? wallet.toLowerCase() : null;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <Toggle active={period} onChange={setPeriod} />

      {error && (
        <div style={{
          padding: 10, color: '#b71c1c', background: '#ffebee',
          border: '1px solid #c62828', marginBottom: 8, fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 30, color: '#777', fontSize: 12 }}>
          Loading rankings…
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#777', fontSize: 12 }}>
          No data yet. Be the first to trade!
        </div>
      )}

      {rows.length > 0 && (
        <div className="win-panel" style={{
          flex: 1, overflow: 'auto', background: '#fff',
        }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: 'var(--win-bg, #c0c0c0)', color: '#222' }}>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: 36 }}>#</th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>Wallet</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Net Profit</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Payouts</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Invested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isMe = me && r.wallet_address.toLowerCase() === me;
                return (
                  <tr key={r.wallet_address}
                    style={{
                      borderTop: '1px dotted #ccc',
                      background: isMe ? '#fff8c4' : undefined,
                      fontWeight: isMe ? 'bold' : 'normal',
                    }}>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <RankBadge rank={r.rank} />
                    </td>
                    <td style={{
                      padding: '4px 6px', fontFamily: 'monospace', fontSize: 11,
                    }}>
                      {shortAddr(r.wallet_address)}
                      {isMe && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, color: '#7a5500',
                          fontFamily: 'Tahoma, sans-serif',
                        }}>(you)</span>
                      )}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                      <NetProfitCell value={r.net_profit} />
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#555' }}>
                      {r.total_payouts.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#555' }}>
                      {r.total_invested.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: 8, fontSize: 11, color: '#777', textAlign: 'center',
      }}>
        {totalUsers} total user{totalUsers === 1 ? '' : 's'} with activity
        {period === '30d' ? ' (last 30 days)' : ''}
      </div>
    </div>
  );
}
