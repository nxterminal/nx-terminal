import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { isNxMarketAdmin } from '../NXMarket';
import CreateMarketModal from './CreateMarketModal';

function formatRelativeTime(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  const diffMs = dt.getTime() - Date.now();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  const past = sec < 0;
  let value, unit;
  if (abs < 60) { value = abs; unit = 's'; }
  else if (abs < 3600) { value = Math.round(abs / 60); unit = 'm'; }
  else if (abs < 86400) { value = Math.round(abs / 3600); unit = 'h'; }
  else { value = Math.round(abs / 86400); unit = 'd'; }
  return past ? `${value}${unit} ago` : `in ${value}${unit}`;
}


function TypeBadge({ market_type }) {
  const isOfficial = market_type === 'official';
  return (
    <span style={{
      padding: '1px 6px', fontSize: 'var(--text-xs, 11px)',
      background: isOfficial ? '#006400' : '#1a4f8a',
      color: '#fff', fontWeight: 'bold', letterSpacing: 0.5,
    }}>
      {isOfficial ? 'OFFICIAL' : 'USER'}
    </span>
  );
}


function StatusBadge({ status, outcome }) {
  let bg = '#666';
  let label = status?.toUpperCase() || '?';
  if (status === 'active') bg = '#2e7d32';
  else if (status === 'closed') bg = '#a06000';
  else if (status === 'resolved') {
    bg = outcome === 'YES' ? '#1565c0' : outcome === 'NO' ? '#c62828' : '#666';
    label = `RESOLVED · ${outcome || '?'}`;
  }
  return (
    <span style={{
      padding: '1px 6px', fontSize: 'var(--text-xs, 11px)',
      background: bg, color: '#fff', fontWeight: 'bold',
    }}>
      {label}
    </span>
  );
}


function PricePill({ side, value }) {
  const isYes = side === 'YES';
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 10px', minWidth: 64,
      background: isYes ? '#e8f5e9' : '#ffebee',
      border: `2px solid ${isYes ? '#2e7d32' : '#c62828'}`,
    }}>
      <span style={{
        fontSize: 'var(--text-sm, 12px)', color: isYes ? '#1b5e20' : '#b71c1c',
        fontWeight: 'bold',
      }}>{side}</span>
      <span style={{
        fontSize: 'var(--text-xl, 18px)', fontWeight: 'bold',
        color: isYes ? '#1b5e20' : '#b71c1c',
      }}>{(value ?? 0.5).toFixed(2)}</span>
    </div>
  );
}


function MarketCard({ market, onClick }) {
  return (
    <div onClick={onClick} className="win-panel" style={{
      padding: 10, marginBottom: 8, cursor: 'pointer',
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 10,
      background: 'var(--win-bg, #c0c0c0)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontWeight: 'bold', fontSize: 'var(--text-base)',
          marginBottom: 4, lineHeight: 1.3,
        }}>
          {market.question}
        </div>
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
          marginBottom: 6,
        }}>
          <TypeBadge market_type={market.market_type} />
          <StatusBadge status={market.status} outcome={market.outcome} />
          {market.category && (
            <span style={{
              fontSize: 'var(--text-xs, 11px)', color: 'var(--text-secondary)',
              padding: '1px 6px', border: '1px solid #888',
            }}>{market.category}</span>
          )}
        </div>
        <div style={{
          fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
        }}>
          {market.status === 'active'
            ? `Closes ${formatRelativeTime(market.close_at)}`
            : market.status === 'resolved'
              ? `Resolved ${formatRelativeTime(market.resolved_at)}`
              : `Closed ${formatRelativeTime(market.close_at)}`}
          {' · '}
          Vol {Math.round(market.total_volume_nxt || 0)} $NXT
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <PricePill side="YES" value={market.price_yes} />
        <PricePill side="NO"  value={market.price_no} />
      </div>
    </div>
  );
}


export default function MarketsList({ wallet, onOpenMarket }) {
  const [markets, setMarkets] = useState(null);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [createMode, setCreateMode] = useState(null); // 'user' | 'official' | null

  const isAdmin = isNxMarketAdmin(wallet);

  const fetchMarkets = useCallback(() => {
    const params = {};
    if (filterStatus !== 'all') params.status = filterStatus;
    if (filterCategory !== 'all') params.category = filterCategory;
    if (filterType !== 'all') params.market_type = filterType;
    api.listMarkets(params)
      .then(d => { setMarkets(d.markets || []); setError(null); })
      .catch(e => setError(e.message || 'Failed to load markets'));
  }, [filterStatus, filterCategory, filterType]);

  useEffect(() => {
    fetchMarkets();
    const iv = setInterval(fetchMarkets, 30000);
    return () => clearInterval(iv);
  }, [fetchMarkets]);

  const onCreated = () => {
    setCreateMode(null);
    fetchMarkets();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar */}
      <div className="win-panel" style={{
        padding: 8, marginBottom: 10,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <label style={{ fontSize: 'var(--text-sm, 12px)' }}>
          Status:&nbsp;
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm, 12px)' }}>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label style={{ fontSize: 'var(--text-sm, 12px)' }}>
          Category:&nbsp;
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm, 12px)' }}>
            <option value="all">All</option>
            <option value="crypto">crypto</option>
            <option value="sports">sports</option>
            <option value="politics">politics</option>
            <option value="entertainment">entertainment</option>
            <option value="other">other</option>
          </select>
        </label>
        <label style={{ fontSize: 'var(--text-sm, 12px)' }}>
          Type:&nbsp;
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm, 12px)' }}>
            <option value="all">All</option>
            <option value="official">Official</option>
            <option value="user">User</option>
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreateMode('user')} className="win-btn"
          disabled={!wallet}
          style={{ padding: '4px 10px', fontWeight: 'bold' }}>
          ➕ Create Market (500 $NXT)
        </button>
        {isAdmin && (
          <button onClick={() => setCreateMode('official')} className="win-btn"
            style={{
              padding: '4px 10px', fontWeight: 'bold',
              background: '#fff8c4',
            }}>
            👑 Create Official (Admin)
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div style={{
            padding: 10, color: '#b71c1c', background: '#ffebee',
            border: '1px solid #c62828', marginBottom: 8,
          }}>
            Error: {error}
          </div>
        )}
        {markets === null && !error && (
          <div style={{
            color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60,
          }}>
            Loading markets...
          </div>
        )}
        {markets && markets.length === 0 && (
          <div style={{
            color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60,
          }}>
            No markets found. Be the first to create one!
          </div>
        )}
        {markets && markets.map(m => (
          <MarketCard key={m.id} market={m}
            onClick={() => onOpenMarket && onOpenMarket(m.id)} />
        ))}
      </div>

      {createMode && (
        <CreateMarketModal
          mode={createMode}
          wallet={wallet}
          onClose={() => setCreateMode(null)}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}
