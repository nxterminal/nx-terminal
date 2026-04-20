import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

// Admin resolve double-confirmation. Two gates required before the
// "Confirm Resolution" button enables: (1) the policy checkbox, (2)
// typing the keyword RESOLVE. Above them, a live preview of the
// economic outcome of the resolve so the admin can sanity-check the
// payout split.

export default function ResolveMarketConfirm({
  market, resolution, wallet, onClose, onResolved,
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [typed, setTyped] = useState('');
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  // Pull the latest detail so the preview reflects the trades-as-of-now.
  useEffect(() => {
    let cancelled = false;
    api.getMarketDetail(market.id).then(d => {
      if (!cancelled) setDetail(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [market.id]);

  const preview = useMemo(() => {
    if (!detail) return null;
    const trades = detail.recent_trades || [];
    const buys = trades
      .filter(t => t.side === 'buy')
      .reduce((s, t) => s + Number(t.nxt_amount), 0);
    const sells = trades
      .filter(t => t.side === 'sell')
      .reduce((s, t) => s + Number(t.nxt_amount), 0);
    const poolTotal = Math.max(0, Math.floor(buys - sells));
    const treasuryFee = Math.floor(poolTotal * 3 / 100);
    const isUser = market.market_type === 'user';
    const creatorFeePct = Number(market.creator_fee_percent || 0);
    const creatorCommission = isUser && poolTotal > 0
      ? Math.floor(poolTotal * creatorFeePct / 100)
      : 0;
    const distributable = poolTotal - treasuryFee - creatorCommission;
    // Approx winners by walking trades — the exact set depends on
    // the live positions table; this preview is best-effort.
    const winnerWallets = new Set(
      trades
        .filter(t => t.outcome === resolution && t.side === 'buy')
        .map(t => t.wallet_address?.toLowerCase()),
    );
    return {
      poolTotal, treasuryFee, creatorCommission, distributable,
      winnersCount: winnerWallets.size,
      isUser,
    };
  }, [detail, market, resolution]);

  const isInvalid = resolution === 'invalid';
  // Invalid resolutions use a separate keyword ("INVALID") since the
  // economic consequences differ so much from a normal YES/NO resolve
  // — the admin should have to think about which they're typing.
  const requiredKeyword = isInvalid ? 'INVALID' : 'RESOLVE';
  const canSubmit = confirmed
    && typed.trim().toUpperCase() === requiredKeyword
    && stage === 'idle';

  const submit = async () => {
    if (!canSubmit) return;
    setStage('submitting');
    setError(null);
    try {
      await api.resolveMarket(wallet, market.id, resolution);
      onResolved && onResolved();
    } catch (e) {
      setError(e.message || 'Resolve failed');
      setStage('idle');
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10040,
    }}>
      <div onClick={e => e.stopPropagation()} className="win-raised" style={{
        width: 420, background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #8b0000, #c62828)',
          color: '#fff', padding: '4px 8px', fontWeight: 'bold',
          fontSize: 'var(--text-base)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{isInvalid
            ? '⚠ MARK MARKET INVALID — IRREVERSIBLE'
            : '⚠ RESOLVE MARKET — IRREVERSIBLE'}</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12 }}>
          <div style={{
            fontSize: 'var(--text-lg, 16px)', fontWeight: 'bold',
            marginBottom: 8, textAlign: 'center',
          }}>
            {isInvalid
              ? `Mark market #${market.id} as INVALID?`
              : `Resolve market #${market.id} as '${resolution}'?`}
          </div>
          <div className="win-panel" style={{
            padding: 8, marginBottom: 10, background: 'var(--win-bg, #c0c0c0)',
          }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              {market.question}
            </div>
          </div>

          {isInvalid && (
            <div className="win-panel" style={{
              padding: 8, marginBottom: 10, background: '#fff',
              fontSize: 'var(--text-sm, 12px)',
            }}>
              <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                What happens when you mark INVALID:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                <li>Every bettor is refunded their <b>cost basis</b>.</li>
                <li><b>No treasury fee</b>, <b>no creator commission</b>.</li>
                <li>Seed liquidity stays locked (as always).</li>
                <li>Market status becomes <b>resolved · invalid</b>.</li>
              </ul>
            </div>
          )}

          {!isInvalid && preview && (
            <div className="win-panel" style={{
              padding: 8, marginBottom: 10, background: '#fff',
              fontSize: 'var(--text-sm, 12px)',
            }}>
              <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                Estimated payout split:
              </div>
              <div>Pool total: <b>{preview.poolTotal} $NXT</b></div>
              <div>Treasury fee (3%): <b>-{preview.treasuryFee}</b></div>
              {preview.isUser && (
                <div>Creator commission (5%): <b>-{preview.creatorCommission}</b></div>
              )}
              <div style={{ marginTop: 2 }}>
                Distributable to {resolution} winners:&nbsp;
                <b>{preview.distributable} $NXT</b>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                ~{preview.winnersCount} winning wallet(s) (best-effort estimate
                from trade history)
              </div>
            </div>
          )}

          <label style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input type="checkbox" checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)} />
            <span style={{ fontSize: 'var(--text-sm, 12px)' }}>
              I confirm this resolution is correct and final.
            </span>
          </label>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Type "{requiredKeyword}" to confirm:
            </div>
            <input type="text" value={typed}
              onChange={e => setTyped(e.target.value)}
              style={{
                width: '100%', padding: 4, fontFamily: "'VT323', monospace",
                fontSize: 'var(--text-base)', background: '#fff',
                border: '2px inset #888', boxSizing: 'border-box',
              }} />
          </label>

          {error && (
            <div style={{
              padding: 6, marginBottom: 8, color: '#b71c1c',
              background: '#ffebee', border: '1px solid #c62828',
              fontSize: 'var(--text-sm, 12px)',
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="win-btn"
              style={{ padding: '4px 12px' }}
              disabled={stage === 'submitting'}>
              Cancel
            </button>
            <button onClick={submit} className="win-btn"
              style={{
                padding: '4px 14px', fontWeight: 'bold',
                background: canSubmit ? '#ef9a9a' : undefined,
                color: canSubmit ? '#7f0000' : undefined,
              }}
              disabled={!canSubmit}>
              {stage === 'submitting'
                ? (isInvalid ? 'Marking invalid…' : 'Resolving…')
                : (isInvalid ? 'Confirm Mark Invalid' : 'Confirm Resolution')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
