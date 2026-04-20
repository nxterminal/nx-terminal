import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { api } from '../../services/api';
import { Win98Icon } from '../../components/Win98Icons';
import { isNxMarketAdmin } from '../NXMarket';
import CreateMarketModal from './CreateMarketModal';
import BuyModal from './BuyModal';
import PendingMarketsAlert from './PendingMarketsAlert';


const CATEGORY_ICON_IDS = new Set([
  'crypto', 'sports', 'politics', 'entertainment', 'other',
]);

function categoryIconId(category) {
  return `cat-${CATEGORY_ICON_IDS.has(category) ? category : 'other'}`;
}


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


function QuickBuyButton({ side, disabled, reason, onClick }) {
  const isYes = side === 'YES';
  const base = isYes ? '#2ecc71' : '#e74c3c';
  const dark = isYes ? '#1e8449' : '#a93226';
  const [hover, setHover] = useState(false);
  const effectiveBg = disabled ? '#bdbdbd'
    : hover ? dark
    : base;

  return (
    <button
      // stopPropagation is critical — the card's onClick opens the
      // DetailModal; without it a quick-buy click would fire both.
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      title={disabled ? reason : undefined}
      style={{
        flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 'bold',
        fontFamily: 'Tahoma, sans-serif',
        color: '#fff', background: effectiveBg,
        border: disabled ? '1px solid #888' : `1px solid ${dark}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: 0.5,
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.1s',
      }}>
      Buy {side}
    </button>
  );
}


function QuickBuyRow({ market, walletConnected, onQuickBuy }) {
  const isActive = market.status === 'active';
  const reason = !walletConnected
    ? 'Connect wallet to bet'
    : !isActive
      ? 'Market closed — awaiting resolution'
      : null;
  const disabled = !walletConnected || !isActive;

  return (
    <div style={{
      display: 'flex', gap: 8, marginTop: 10,
    }}>
      <QuickBuyButton side="YES" disabled={disabled} reason={reason}
        onClick={() => onQuickBuy('YES')} />
      <QuickBuyButton side="NO" disabled={disabled} reason={reason}
        onClick={() => onQuickBuy('NO')} />
    </div>
  );
}


function MarketCard({ market, onClick, walletConnected, onQuickBuy }) {
  const isResolved = market.status === 'resolved';
  const isClosed = market.status === 'closed';
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="win-panel"
      style={{
        padding: 12, cursor: 'pointer',
        background: hover ? '#f5f5ec' : '#ffffff',
        transition: 'background 0.1s',
        fontFamily: 'Tahoma, sans-serif',
        display: 'flex', flexDirection: 'column', minHeight: 200,
      }}>

      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10,
        alignItems: 'start', marginBottom: 10,
      }}>
        <div style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0e8', border: '1px solid #999',
        }}>
          <Win98Icon id={categoryIconId(market.category)} size={24} />
        </div>

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

      {/* Quick-buy buttons — resolved markets skip the row entirely; closed
          markets keep it visible but disabled so users understand the
          state. The buttons stopPropagation so clicking one doesn't also
          fire the card's onClick (which opens DetailModal). */}
      {!isResolved && (
        <QuickBuyRow market={market}
          walletConnected={walletConnected}
          onQuickBuy={(side) => onQuickBuy && onQuickBuy(market, side)} />
      )}

      {/* Spacer pushes footer to the bottom so grid cards align */}
      <div style={{ flex: 1 }} />

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


function MarketsListInner({ wallet, onOpenMarket }, ref) {
  const [markets, setMarkets] = useState(null);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [createMode, setCreateMode] = useState(null); // 'user' | 'official' | null
  const [buyState, setBuyState] = useState(null);    // { market, side } | null
  const [cap, setCap] = useState(null);              // escalera info for Create tooltip

  const isAdmin = isNxMarketAdmin(wallet);
  const walletConnected = !!wallet;

  const handleQuickBuy = (market, side) => {
    if (!walletConnected) return;
    setBuyState({ market, side });
  };

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

  // Cap info for the Create button tooltip + disabled state. Refetched
  // whenever markets change (so resolving/creating a market updates the
  // tooltip without a reload).
  const fetchCap = useCallback(() => {
    if (!wallet) { setCap(null); return; }
    api.getUserCap(wallet).then(setCap).catch(() => setCap(null));
  }, [wallet]);

  useEffect(() => {
    fetchCap();
  }, [fetchCap, markets]);

  // Exposed to the parent (NXMarket.jsx) so cross-tab triggers — e.g.
  // a resolve fired from the Detail modal — can force a refetch even
  // when the ambient 30s polling hasn't ticked yet.
  useImperativeHandle(ref, () => ({
    refresh: () => { fetchMarkets(); fetchCap(); },
  }), [fetchMarkets, fetchCap]);

  const onCreated = () => {
    setCreateMode(null);
    fetchMarkets();
    fetchCap();
  };

  const selectStyle = {
    fontFamily: 'Tahoma, sans-serif', fontSize: 11, padding: '2px 4px',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Admin-only pending-resolution banner — self-hides when the
          wallet isn't admin or there's nothing to show. */}
      <PendingMarketsAlert
        wallet={wallet}
        isAdmin={isAdmin}
        onMarketResolved={() => { fetchMarkets(); fetchCap(); }} />

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
          disabled={!wallet || (cap && !cap.can_create)}
          title={
            !wallet ? 'Connect your wallet to create a market'
            : cap && !cap.can_create
              ? `Cap reached: ${cap.active_markets}/${cap.max_markets} active. Mint more devs or resolve existing markets.`
              : 'Create a new market (costs 1000 $NXT)'
          }
          style={{ padding: '3px 10px', fontSize: 11, fontWeight: 'bold' }}>
          + Create Market (1000 $NXT)
        </button>
        {isAdmin && (
          <button onClick={() => setCreateMode('official')} className="win-btn"
            title="Admin: create an official market (auto-minted seed, no cap)"
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
        {markets && markets.length > 0 && (
          <div style={{
            display: 'grid',
            // Auto-fit gives us 2 cols on the 920px default window and
            // falls back to 1 column gracefully when the user shrinks
            // the window below ~720px.
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 12,
          }}>
            {markets.map(m => (
              <MarketCard key={m.id} market={m}
                walletConnected={walletConnected}
                onQuickBuy={handleQuickBuy}
                onClick={() => onOpenMarket && onOpenMarket(m.id)} />
            ))}
          </div>
        )}
      </div>

      {createMode && (
        <CreateMarketModal
          mode={createMode}
          wallet={wallet}
          onClose={() => setCreateMode(null)}
          onCreated={onCreated}
        />
      )}

      {buyState && (
        <BuyModal
          market={buyState.market}
          side={buyState.side}
          wallet={wallet}
          onClose={() => setBuyState(null)}
          onBought={() => {
            setBuyState(null);
            fetchMarkets();
          }}
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
        + Create Market (1000 $NXT)
      </button>
    </div>
  );
}


const MarketsList = forwardRef(MarketsListInner);
export default MarketsList;
