import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { useWallet } from '../../hooks/useWallet';

// PR 1's read endpoints don't expose a per-wallet positions feed, so
// we walk every market the user has *traded* in by:
//   1. listing all markets (active + resolved + closed)
//   2. fetching detail for each
//   3. recomputing position from recent_trades on the buyer side
// Inefficient at scale but acceptable for PR 4 (markets count is low).
// A backend GET /api/nxmarket/positions?wallet=X would be the proper
// fix in a future PR.

function shortQ(q, n = 60) {
  if (!q) return '';
  return q.length > n ? q.slice(0, n - 1) + '…' : q;
}


function PositionRow({ entry, onExit, onOpenMarket }) {
  const { market, position, isResolved } = entry;
  const sideColor = position.outcome === 'YES' ? '#1b5e20' : '#b71c1c';
  const currPrice = position.outcome === 'YES'
    ? Number(market.price_yes ?? 0.5)
    : Number(market.price_no ?? 0.5);
  const currentValue = position.shares * currPrice;
  const pnl = currentValue - position.cost_basis;
  const pnlColor = pnl >= 0 ? '#1b5e20' : '#b71c1c';

  let payout = null;
  if (isResolved) {
    const won = market.outcome === position.outcome;
    payout = won ? 'paid' : 0;
  }

  return (
    <div className="win-panel" style={{
      padding: 8, marginBottom: 6, background: 'var(--win-bg, #c0c0c0)',
    }}>
      <div onClick={() => onOpenMarket(market.id)} style={{
        cursor: 'pointer', textDecoration: 'underline',
        fontSize: 'var(--text-sm, 12px)', marginBottom: 4,
      }}>
        #{market.id} — {shortQ(market.question)}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center',
        fontSize: 'var(--text-sm, 12px)',
      }}>
        <span style={{ color: sideColor, fontWeight: 'bold' }}>
          {position.outcome} · {position.shares.toFixed(2)} shares
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Cost {position.cost_basis.toFixed(0)}
          {!isResolved && (
            <> · Cur ~{currentValue.toFixed(0)}</>
          )}
        </span>
        {!isResolved ? (
          <span style={{ color: pnlColor, fontWeight: 'bold' }}>
            P/L {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
          </span>
        ) : (
          <span style={{
            color: market.outcome === position.outcome ? '#1b5e20' : '#b71c1c',
            fontWeight: 'bold',
          }}>
            {market.outcome === position.outcome ? 'WON' : 'LOST'}
          </span>
        )}
      </div>
      {!isResolved && (
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <button onClick={() => onExit(entry)} className="win-btn"
            style={{ padding: '2px 10px', background: '#ffe082' }}>
            Exit
          </button>
        </div>
      )}
    </div>
  );
}


export default function MyPositions({ wallet, onOpenMarket }) {
  const { connect } = useWallet();
  const [active, setActive] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!wallet) {
      setActive([]); setResolved([]);
      return;
    }
    try {
      // Pull active + resolved + closed markets in parallel.
      const [act, res, clo] = await Promise.all([
        api.listMarkets({ status: 'active' }),
        api.listMarkets({ status: 'resolved' }),
        api.listMarkets({ status: 'closed' }),
      ]);
      const all = [
        ...(act.markets || []),
        ...(res.markets || []),
        ...(clo.markets || []),
      ];
      const details = await Promise.all(
        all.map(m => api.getMarketDetail(m.id).catch(() => null))
      );
      const positions = [];
      const positionsResolved = [];
      const me = wallet.toLowerCase();
      for (const d of details) {
        if (!d || !d.market) continue;
        const trades = (d.recent_trades || []).filter(
          t => t.wallet_address?.toLowerCase() === me,
        );
        for (const side of ['YES', 'NO']) {
          const buys = trades.filter(t => t.side === 'buy' && t.outcome === side);
          const sells = trades.filter(t => t.side === 'sell' && t.outcome === side);
          const shares = buys.reduce((s, t) => s + Number(t.shares), 0)
            - sells.reduce((s, t) => s + Number(t.shares), 0);
          const cost = buys.reduce((s, t) => s + Number(t.nxt_amount), 0);
          if (shares > 0.0001) {
            const entry = {
              market: d.market,
              position: { outcome: side, shares, cost_basis: cost },
              isResolved: d.market.status === 'resolved',
            };
            if (entry.isResolved) positionsResolved.push(entry);
            else positions.push(entry);
          } else if (d.market.status === 'resolved' && (buys.length || sells.length)) {
            // Sold-out before resolution but had history — show as closed.
            positionsResolved.push({
              market: d.market,
              position: { outcome: side, shares: 0, cost_basis: cost },
              isResolved: true,
            });
          }
        }
      }
      setActive(positions);
      setResolved(positionsResolved);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load positions');
    }
  }, [wallet]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  if (!wallet) {
    return (
      <div style={{
        textAlign: 'center', marginTop: 60, color: 'var(--text-secondary)',
      }}>
        <div>Connect your wallet to see your positions.</div>
        <button
          onClick={connect}
          className="win-btn"
          style={{ marginTop: 12, padding: '6px 20px', fontSize: 'var(--text-sm)', fontWeight: 'bold' }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <div style={{
          padding: 8, color: '#b71c1c', background: '#ffebee',
          border: '1px solid #c62828', marginBottom: 8,
        }}>Error: {error}</div>
      )}

      <div style={{
        fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
        margin: '4px 0',
      }}>
        Active positions
      </div>
      {active === null && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
          Loading…
        </div>
      )}
      {active && active.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
          You have no active positions yet.
        </div>
      )}
      {active && active.map((e, i) => (
        <PositionRow key={`a-${e.market.id}-${e.position.outcome}-${i}`}
          entry={e}
          onOpenMarket={onOpenMarket}
          onExit={() => onOpenMarket(e.market.id)} />
      ))}

      <div style={{
        fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)',
        margin: '12px 0 4px',
      }}>
        Resolved positions
      </div>
      {resolved && resolved.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
          No resolved positions yet.
        </div>
      )}
      {resolved && resolved.map((e, i) => (
        <PositionRow key={`r-${e.market.id}-${e.position.outcome}-${i}`}
          entry={e}
          onOpenMarket={onOpenMarket}
          onExit={() => onOpenMarket(e.market.id)} />
      ))}
    </div>
  );
}
