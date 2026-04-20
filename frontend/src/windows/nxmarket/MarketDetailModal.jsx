import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { isNxMarketAdmin } from '../NXMarket';
import MarketPriceChart from './MarketPriceChart';
import BuyModal from './BuyModal';
import ExitModal from './ExitModal';
import ResolveMarketConfirm from './ResolveMarketConfirm';
import CommentsList from './CommentsList';

function shortAddr(addr) {
  if (!addr) return '?';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtRel(iso) {
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


function ResolutionBanner({ outcome }) {
  const won = outcome === 'YES' ? 'YES' : outcome === 'NO' ? 'NO' : null;
  if (!won) return null;
  const bg = won === 'YES' ? '#e8f5e9' : '#ffebee';
  const fg = won === 'YES' ? '#1b5e20' : '#b71c1c';
  return (
    <div style={{
      padding: 10, background: bg, color: fg,
      border: `2px solid ${fg}`, fontWeight: 'bold',
      fontSize: 'var(--text-lg, 16px)', textAlign: 'center', marginBottom: 10,
    }}>
      RESOLUTION: {won} won
    </div>
  );
}


function TradesTable({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div style={{
        color: 'var(--text-secondary)', textAlign: 'center', padding: 12,
        fontSize: 'var(--text-sm, 12px)',
      }}>
        No trades yet
      </div>
    );
  }
  return (
    <div className="win-panel" style={{
      padding: 4, maxHeight: 180, overflow: 'auto', background: '#fff',
    }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 'var(--text-sm, 12px)',
      }}>
        <thead>
          <tr style={{ background: 'var(--win-bg, #c0c0c0)' }}>
            <th style={{ textAlign: 'left', padding: '2px 4px' }}>Wallet</th>
            <th style={{ textAlign: 'left', padding: '2px 4px' }}>Side</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>Shares</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>$NXT</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>Price</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>When</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id} style={{ borderTop: '1px dotted #ccc' }}>
              <td style={{ padding: '2px 4px' }}>{shortAddr(t.wallet_address)}</td>
              <td style={{
                padding: '2px 4px',
                color: t.outcome === 'YES' ? '#1b5e20' : '#b71c1c',
              }}>
                {t.side?.toUpperCase()} {t.outcome}
              </td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                {Number(t.shares).toFixed(2)}
              </td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                {Math.round(Number(t.nxt_amount))}
              </td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                {Number(t.price).toFixed(4)}
              </td>
              <td style={{
                padding: '2px 4px', textAlign: 'right',
                color: 'var(--text-secondary)',
              }}>{fmtRel(t.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default function MarketDetailModal({ marketId, wallet, onClose, onMarketResolved }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [buySide, setBuySide] = useState(null);   // 'YES' | 'NO' | null
  const [exitOpen, setExitOpen] = useState(false);
  const [resolveSide, setResolveSide] = useState(null); // 'YES' | 'NO'
  const [commentCount, setCommentCount] = useState(0);

  const isAdmin = isNxMarketAdmin(wallet);

  const fetchDetail = useCallback(() => {
    api.getMarketDetail(marketId)
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message || 'Failed to load market'));
  }, [marketId]);

  useEffect(() => {
    fetchDetail();
    const iv = setInterval(fetchDetail, 15000);
    return () => clearInterval(iv);
  }, [fetchDetail]);

  if (!data && !error) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 20 }}>Loading market…</div>
      </Overlay>
    );
  }

  if (error) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 20, color: '#b71c1c' }}>Error: {error}</div>
      </Overlay>
    );
  }

  const market = data.market;
  // The detail endpoint doesn't ship per-user positions in PR 1's
  // contract; recent_trades carries enough to recompute the user's
  // net position for the simple display below. (MyPositions tab in
  // commit 4 fetches the authoritative snapshot.)
  const myTrades = (data.recent_trades || []).filter(
    t => wallet && t.wallet_address?.toLowerCase() === wallet.toLowerCase()
  );
  const myPositions = ['YES', 'NO'].map(side => {
    const buys = myTrades.filter(t => t.side === 'buy' && t.outcome === side);
    const sells = myTrades.filter(t => t.side === 'sell' && t.outcome === side);
    const shares = buys.reduce((s, t) => s + Number(t.shares), 0)
      - sells.reduce((s, t) => s + Number(t.shares), 0);
    const cost = buys.reduce((s, t) => s + Number(t.nxt_amount), 0);
    return { outcome: side, shares, cost_basis: cost };
  }).filter(p => p.shares > 0.0001);

  const isActive = market.status === 'active';
  const isResolved = market.status === 'resolved';

  return (
    <Overlay onClose={onClose} wide>
      {/* Title bar */}
      <div style={{
        background: 'linear-gradient(90deg, #000080, #1084d0)',
        color: '#fff', padding: '4px 8px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        fontSize: 'var(--text-base)', fontWeight: 'bold',
      }}>
        <span>NXMARKET · #{market.id}</span>
        <button onClick={onClose} className="win-btn"
          style={{ padding: '0 6px', fontWeight: 'bold' }}>X</button>
      </div>

      <div style={{ padding: 12, fontFamily: "'VT323', monospace", maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-lg, 16px)', fontWeight: 'bold', marginBottom: 4 }}>
            {market.question}
          </div>
          <div style={{
            fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
            display: 'flex', gap: 10, flexWrap: 'wrap',
          }}>
            <span>Created by {shortAddr(market.created_by)}</span>
            <span>·</span>
            <span>Type: {market.market_type}</span>
            <span>·</span>
            <span>Cat: {market.category || '—'}</span>
            <span>·</span>
            <span>
              {isActive ? `Closes ${fmtRel(market.close_at)}`
                : isResolved ? `Resolved ${fmtRel(market.resolved_at)}`
                : `Closed ${fmtRel(market.close_at)}`}
            </span>
          </div>
        </div>

        {isResolved && <ResolutionBanner outcome={market.outcome} />}

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          {/* Left: chart + prices */}
          <div>
            <MarketPriceChart priceHistory={data.price_history} />
            <div className="win-panel" style={{
              padding: 8, marginTop: 8, display: 'flex',
              justifyContent: 'space-around', background: 'var(--win-bg, #c0c0c0)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-sm, 12px)', color: '#1b5e20' }}>YES</div>
                <div style={{ fontSize: 'var(--text-2xl, 22px)', fontWeight: 'bold', color: '#1b5e20' }}>
                  {Number(market.price_yes ?? 0.5).toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-sm, 12px)', color: '#b71c1c' }}>NO</div>
                <div style={{ fontSize: 'var(--text-2xl, 22px)', fontWeight: 'bold', color: '#b71c1c' }}>
                  {Number(market.price_no ?? 0.5).toFixed(2)}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
              marginTop: 6, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>YES pool: {Number(market.shares_yes).toFixed(2)}</span>
              <span>NO pool: {Number(market.shares_no).toFixed(2)}</span>
              <span>Vol: {Math.round(market.total_volume_nxt || 0)} $NXT</span>
            </div>
          </div>

          {/* Right: actions */}
          <div>
            {isActive && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => setBuySide('YES')} className="win-btn"
                    style={{
                      flex: 1, padding: '8px 0', fontWeight: 'bold',
                      background: '#a5d6a7',
                    }}
                    disabled={!wallet}>
                    Buy YES
                  </button>
                  <button onClick={() => setBuySide('NO')} className="win-btn"
                    style={{
                      flex: 1, padding: '8px 0', fontWeight: 'bold',
                      background: '#ef9a9a',
                    }}
                    disabled={!wallet}>
                    Buy NO
                  </button>
                </div>
                {myPositions.map(pos => (
                  <div key={pos.outcome} className="win-panel" style={{
                    padding: 8, marginBottom: 6, background: 'var(--win-bg, #c0c0c0)',
                  }}>
                    <div style={{ fontSize: 'var(--text-sm, 12px)' }}>
                      Your position:&nbsp;
                      <b style={{ color: pos.outcome === 'YES' ? '#1b5e20' : '#b71c1c' }}>
                        {pos.shares.toFixed(2)} {pos.outcome}
                      </b>
                      {' '}<span style={{ color: 'var(--text-secondary)' }}>
                        (cost {pos.cost_basis.toFixed(0)} $NXT)
                      </span>
                    </div>
                    <button onClick={() => setExitOpen(pos.outcome)} className="win-btn"
                      style={{ marginTop: 4, padding: '2px 8px', width: '100%' }}>
                      Exit {pos.outcome} Position
                    </button>
                  </div>
                ))}
                {isAdmin && (
                  <>
                    <div style={{ borderTop: '1px solid #888', margin: '10px 0 6px' }} />
                    <div style={{
                      fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
                      marginBottom: 4,
                    }}>
                      👑 Admin actions (irreversible):
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setResolveSide('YES')} className="win-btn"
                        style={{ flex: 1, padding: '4px 0', background: '#fff8c4' }}>
                        Resolve YES
                      </button>
                      <button onClick={() => setResolveSide('NO')} className="win-btn"
                        style={{ flex: 1, padding: '4px 0', background: '#fff8c4' }}>
                        Resolve NO
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            {!isActive && !isResolved && (
              <div style={{
                color: 'var(--text-secondary)', textAlign: 'center', padding: 20,
              }}>
                Market closed — awaiting resolution.
              </div>
            )}
          </div>
        </div>

        {/* Recent trades */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
            marginBottom: 4,
          }}>Recent trades</div>
          <TradesTable trades={data.recent_trades} />
        </div>

        {/* Comments (PR C1) */}
        <div style={{ marginTop: 18, borderTop: '1px solid #999', paddingTop: 10 }}>
          <div style={{
            fontSize: 13, fontWeight: 'bold', color: '#333',
            fontFamily: 'Tahoma, sans-serif', marginBottom: 6,
          }}>
            Comments ({commentCount})
          </div>
          <CommentsList
            marketId={market.id}
            wallet={wallet}
            onCountChange={setCommentCount}
          />
        </div>
      </div>

      {buySide && (
        <BuyModal market={market} side={buySide} wallet={wallet}
          onClose={() => setBuySide(null)}
          onBought={() => { setBuySide(null); fetchDetail(); }} />
      )}
      {exitOpen && (
        <ExitModal market={market}
          position={myPositions.find(p => p.outcome === exitOpen)}
          wallet={wallet}
          onClose={() => setExitOpen(false)}
          onExited={() => { setExitOpen(false); fetchDetail(); }} />
      )}
      {resolveSide && (
        <ResolveMarketConfirm market={market} resolution={resolveSide}
          wallet={wallet}
          onClose={() => setResolveSide(null)}
          onResolved={() => {
            setResolveSide(null);
            fetchDetail();
            // Notify the parent so MarketsList can refetch immediately
            // (prevents the market from showing as 'active' for up to
            // the 30s polling window after a resolve).
            if (onMarketResolved) onMarketResolved();
          }} />
      )}
    </Overlay>
  );
}


function Overlay({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10025,
    }}>
      <div onClick={e => e.stopPropagation()} className="win-raised" style={{
        width: wide ? 760 : 380, maxWidth: '95vw',
        background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        {children}
      </div>
    </div>
  );
}
