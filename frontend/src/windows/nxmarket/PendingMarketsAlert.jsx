import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import ResolveMarketConfirm from './ResolveMarketConfirm';


function timeoutColor(days) {
  if (days < 7) return '#b71c1c';   // red
  if (days < 14) return '#a06000';  // orange
  return '#555';                    // neutral
}


function PendingRow({ market, wallet, onResolveOpen }) {
  const timeoutTxtColor = timeoutColor(market.days_until_timeout);
  return (
    <div className="win-panel" style={{
      padding: 10, marginBottom: 8, background: '#ffffff',
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#222', marginBottom: 2 }}>
        {market.question}
      </div>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 8 }}>
        {market.market_type} · {market.category || 'other'}
        {' · '}Closed {market.closed_since_days}d ago
        {' · '}
        <span style={{ color: timeoutTxtColor, fontWeight: 'bold' }}>
          Auto-timeout in {market.days_until_timeout}d
        </span>
      </div>
      <div style={{
        fontSize: 12, color: '#333', marginBottom: 8,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
      }}>
        <div>
          Pool: <b>{market.pool_total.toLocaleString()} $NXT</b>
          {' · '}
          {market.bettors_count} bettor{market.bettors_count === 1 ? '' : 's'}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#1e8449', fontWeight: 'bold' }}>
            YES: {market.yes_volume.toLocaleString()}
          </span>
          {' ('}{market.yes_bettors}{')'}
          {' · '}
          <span style={{ color: '#a93226', fontWeight: 'bold' }}>
            NO: {market.no_volume.toLocaleString()}
          </span>
          {' ('}{market.no_bettors}{')'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onResolveOpen(market, 'YES')} className="win-btn"
          style={{ flex: 1, padding: '4px 0', background: '#fff8c4',
                   fontSize: 12, fontWeight: 'bold' }}>
          Resolve YES
        </button>
        <button onClick={() => onResolveOpen(market, 'NO')} className="win-btn"
          style={{ flex: 1, padding: '4px 0', background: '#fff8c4',
                   fontSize: 12, fontWeight: 'bold' }}>
          Resolve NO
        </button>
        <button onClick={() => onResolveOpen(market, 'invalid')} className="win-btn"
          style={{ flex: 1, padding: '4px 0', background: '#e0e0e0',
                   fontSize: 12 }}>
          Mark Invalid
        </button>
      </div>
    </div>
  );
}


export default function PendingMarketsAlert({ wallet, isAdmin, onMarketResolved }) {
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [resolveState, setResolveState] = useState(null); // { market, resolution }

  const fetchPending = useCallback(() => {
    if (!wallet || !isAdmin) return;
    api.getPendingMarkets(wallet)
      .then(d => { setPending(d.markets || []); setError(null); })
      .catch(e => setError(e.message || 'Failed to load pending markets'));
  }, [wallet, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchPending();
    const iv = setInterval(fetchPending, 60000);
    return () => clearInterval(iv);
  }, [fetchPending, isAdmin]);

  if (!isAdmin) return null;
  if (pending.length === 0) return null;

  return (
    <div style={{
      marginBottom: 10, background: '#fffbe6',
      border: '2px solid #d4a017',
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '8px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'Tahoma, sans-serif', fontSize: 13,
          color: '#7a5500', fontWeight: 'bold',
          textAlign: 'left',
        }}>
        <span>⚠ {pending.length} market{pending.length === 1 ? '' : 's'} pending resolution</span>
        <span style={{ fontSize: 12 }}>
          {expanded ? 'Collapse ▲' : 'Expand ▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 10px', borderTop: '1px solid #d4a017' }}>
          {error && (
            <div style={{
              padding: 8, marginBottom: 8, color: '#b71c1c',
              background: '#ffebee', border: '1px solid #c62828',
              fontSize: 11,
            }}>{error}</div>
          )}
          {pending.map(m => (
            <PendingRow key={m.id} market={m} wallet={wallet}
              onResolveOpen={(market, resolution) =>
                setResolveState({ market, resolution })} />
          ))}
        </div>
      )}

      {resolveState && (
        <ResolveMarketConfirm
          market={resolveState.market}
          resolution={resolveState.resolution}
          wallet={wallet}
          onClose={() => setResolveState(null)}
          onResolved={() => {
            setResolveState(null);
            fetchPending();
            if (onMarketResolved) onMarketResolved();
          }} />
      )}
    </div>
  );
}
