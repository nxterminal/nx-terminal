import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { isNxMarketAdmin } from '../NXMarket';
import CreateMarketModal from './CreateMarketModal';


const CATEGORY_EMOJI = {
  crypto: '\u{1FA99}',          // coin
  sports: '\u26BD',             // soccer ball
  politics: '\u{1F3DB}\uFE0F',  // classical building
  entertainment: '\u{1F3AC}',   // clapper
  other: '\u{1F4CC}',           // pushpin
};


function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  const past = sec < 0;
  let v, u;
  if (abs < 60) { v = abs; u = 's'; }
  else if (abs < 3600) { v = Math.round(abs / 60); u = 'm'; }
  else if (abs < 86400) { v = Math.round(abs / 3600); u = 'h'; }
  else { v = Math.round(abs / 86400); u = 'd'; }
  return past ? `${v}${u} ago` : `in ${v}${u}`;
}


function TypeBadge({ market_type }) {
  const isOfficial = market_type === 'official';
  return (
    <span style={{
      padding: '2px 8px', fontSize: 10,
      background: isOfficial ? '#1565c0' : '#2e7d32',
      color: '#fff', fontWeight: 'bold', letterSpacing: 0.8,
      fontFamily: 'Tahoma, sans-serif',
    }}>
      {isOfficial ? 'OFFICIAL' : 'USER'}
    </span>
  );
}


function ProbabilityRow({ side, price }) {
  const isYes = side === 'YES';
  const pct = Math.round((price ?? 0.5) * 100);
  const color = isYes ? '#2ecc71' : '#e74c3c';
  const darkColor = isYes ? '#1e8449' : '#a93226';
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{
          fontFamily: 'Tahoma, sans-serif', fontSize: 13, fontWeight: 'bold',
          color: darkColor, letterSpacing: 0.5,
        }}>
          {side}
        </span>
        <span style={{
          fontFamily: 'Tahoma, sans-serif', fontSize: 20, fontWeight: 'bold',
          color: darkColor,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: 10, width: '100%', background: '#ddd',
        border: '1px inset #aaa', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(180deg, ${color} 0%, ${darkColor} 100%)`,
        }} />
      </div>
    </div>
  );
}


function MarketCard({ market, onClick }) {
  const isResolved = market.status === 'resolved';
  const isClosed = market.status === 'closed';
  const emoji = CATEGORY_EMOJI[market.category] || CATEGORY_EMOJI.other;
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="win-panel"
      style={{
        padding: 12, marginBottom: 10, cursor: 'pointer',
        background: hover ? '#f5f5ec' : '#ffffff',
        transition: 'background 0.1s',
        fontFamily: 'Tahoma, sans-serif',
      }}>

      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10,
        alignItems: 'start', marginBottom: 10,
      }}>
        <div style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22,
          background: '#f0f0e8', border: '1px solid #999',
        }}>{emoji}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 'bold', lineHeight: 1.3, color: '#222',
            marginBottom: 2,
          }}>
            {market.question}
          </div>
          <div style={{ fontSize: 11, color: '#777' }}>
            {market.category || 'other'}
            {' \u00B7 '}
            {market.status === 'active'
              ? `closes ${formatRelativeTime(market.close_at)}`
              : isResolved
                ? `resolved ${formatRelativeTime(market.resolved_at)}`
                : `closed ${formatRelativeTime(market.close_at)}`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <TypeBadge market_type={market.market_type} />
        </div>
      </div>

      {/* Resolved banner — replaces price widget */}
      {isResolved && (
        <ResolvedBanner outcome={market.outcome} />
      )}

      {/* Closed (pending resolution) banner — show prices faded */}
      {isClosed && (
        <div style={{
          padding: '6px 8px', marginBottom: 8,
          background: '#fff8c4', border: '1px solid #a07a00',
          color: '#7a5e00', fontSize: 11, fontWeight: 'bold',
          textAlign: 'center', letterSpacing: 0.5,
        }}>
          {'\u231B'} PENDING RESOLUTION
        </div>
      )}

      {/* Probability row — hidden when resolved */}
      {!isResolved && (
        <div style={{
          display: 'flex', gap: 14, padding: '2px 4px',
          opacity: isClosed ? 0.6 : 1,
        }}>
          <ProbabilityRow side="YES" price={market.price_yes} />
          <ProbabilityRow side="NO"  price={market.price_no} />
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 10, fontSize: 11, color: '#777',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Vol: <b>{Math.round(market.total_volume_nxt || 0).toLocaleString()}</b> $NXT</span>
        <span>Pool b = {Math.round(Number(market.liquidity_b) || 0)}</span>
      </div>
    </div>
  );
}


function ResolvedBanner({ outcome }) {
  const won = outcome === 'YES' || outcome === 'NO';
  if (!won) {
    return (
      <div style={{
        padding: '8px 10px', marginBottom: 4, background: '#eeeeee',
        border: '1px solid #999', color: '#555', fontSize: 12,
        fontWeight: 'bold', textAlign: 'center',
      }}>
        MARKET INVALIDATED
      </div>
    );
  }
  const isYes = outcome === 'YES';
  const bg = isYes ? '#e8f8ee' : '#fdecea';
  const fg = isYes ? '#1e8449' : '#a93226';
  return (
    <div style={{
      padding: '8px 10px', marginBottom: 4, background: bg,
      border: `2px solid ${fg}`, color: fg, fontSize: 13,
      fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5,
    }}>
      {'\u2713'} RESOLVED: {outcome} WON
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

  const selectStyle = {
    fontFamily: 'Tahoma, sans-serif', fontSize: 11, padding: '2px 4px',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar */}
      <div className="win-panel" style={{
        padding: 8, marginBottom: 10,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        fontFamily: 'Tahoma, sans-serif', fontSize: 11,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#555' }}>Status</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={selectStyle}>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#555' }}>Category</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={selectStyle}>
            <option value="all">All</option>
            <option value="crypto">crypto</option>
            <option value="sports">sports</option>
            <option value="politics">politics</option>
            <option value="entertainment">entertainment</option>
            <option value="other">other</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#555' }}>Type</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={selectStyle}>
            <option value="all">All</option>
            <option value="official">Official</option>
            <option value="user">User</option>
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreateMode('user')} className="win-btn"
          disabled={!wallet}
          style={{ padding: '3px 10px', fontSize: 11, fontWeight: 'bold' }}>
          + Create Market (500 $NXT)
        </button>
        {isAdmin && (
          <button onClick={() => setCreateMode('official')} className="win-btn"
            style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 'bold',
              background: '#fff8c4',
            }}>
            Create Official
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 2px' }}>
        {error && (
          <div style={{
            padding: 10, color: '#b71c1c', background: '#ffebee',
            border: '1px solid #c62828', marginBottom: 8,
            fontFamily: 'Tahoma, sans-serif', fontSize: 11,
          }}>
            Error: {error}
          </div>
        )}
        {markets === null && !error && (
          <div style={{
            color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60,
            fontFamily: 'Tahoma, sans-serif',
          }}>
            Loading markets...
          </div>
        )}
        {markets && markets.length === 0 && (
          <EmptyState wallet={wallet}
            onCreate={() => setCreateMode('user')} />
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


function EmptyState({ wallet, onCreate }) {
  return (
    <div style={{
      textAlign: 'center', marginTop: 60, fontFamily: 'Tahoma, sans-serif',
    }}>
      <div style={{
        fontSize: 40, color: '#bbb', marginBottom: 8, lineHeight: 1,
      }}>?</div>
      <div style={{
        fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 4,
      }}>
        No markets yet
      </div>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 12 }}>
        Be the first to create one.
      </div>
      <button onClick={onCreate} className="win-btn"
        disabled={!wallet}
        style={{ padding: '4px 14px', fontSize: 12, fontWeight: 'bold' }}>
        + Create Market (500 $NXT)
      </button>
    </div>
  );
}
