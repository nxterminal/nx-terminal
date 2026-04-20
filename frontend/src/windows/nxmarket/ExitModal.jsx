import { useMemo, useState } from 'react';
import { api } from '../../services/api';
import { calculateValueToSell, calculatePrice } from '../../utils/lmsr';

export default function ExitModal({ market, position, wallet, onClose, onExited }) {
  const maxShares = Number(position.shares);
  const [shares, setShares] = useState(maxShares.toString());
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);

  const sharesNum = Math.min(Math.max(0, Number(shares) || 0), maxShares);

  const preview = useMemo(() => {
    if (sharesNum <= 0) return null;
    try {
      const sell = calculateValueToSell(
        market.shares_yes, market.shares_no, market.liquidity_b,
        position.outcome, sharesNum,
      );
      const newPrices = calculatePrice(
        sell.new_shares_yes, sell.new_shares_no, market.liquidity_b,
      );
      const proportionOfPosition = sharesNum / maxShares;
      const proportionalCost = Number(position.cost_basis) * proportionOfPosition;
      return {
        ...sell,
        new_price_yes: newPrices.price_yes,
        new_price_no: newPrices.price_no,
        proportional_cost: proportionalCost,
        pnl: sell.value_after_penalty - proportionalCost,
      };
    } catch {
      return null;
    }
  }, [sharesNum, market, position, maxShares]);

  const submit = async () => {
    if (sharesNum <= 0 || stage === 'submitting') return;
    setStage('submitting');
    setError(null);
    try {
      const r = await api.exitPosition(market.id, {
        wallet, side: position.outcome, shares_to_sell: sharesNum,
      });
      onExited && onExited(r);
    } catch (e) {
      setError(e.message || 'Exit failed');
      setStage('idle');
    }
  };

  const remaining = maxShares - sharesNum;
  const isPartial = remaining > 0.0001;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10030,
    }}>
      <div onClick={e => e.stopPropagation()} className="win-raised" style={{
        width: 380, background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Exit {position.outcome} position</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12, fontSize: 'var(--text-base)' }}>
          <div className="win-panel" style={{
            padding: 8, marginBottom: 10, background: 'var(--win-bg, #c0c0c0)',
          }}>
            <div>Position: <b>{maxShares.toFixed(4)} {position.outcome} shares</b></div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Cost basis: <b>{Number(position.cost_basis).toFixed(2)} $NXT</b>
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Shares to sell:
            </div>
            <input type="range" min={0} max={maxShares} step={maxShares / 100}
              value={sharesNum}
              onChange={e => setShares(e.target.value)}
              style={{ width: '100%' }} />
            <input type="number" min={0} max={maxShares} step="any"
              value={shares} onChange={e => setShares(e.target.value)}
              style={{
                width: '100%', padding: 4, fontFamily: "'VT323', monospace",
                fontSize: 'var(--text-base)', background: '#fff',
                border: '2px inset #888', boxSizing: 'border-box',
              }} />
          </label>

          {preview && (
            <div className="win-panel" style={{
              padding: 8, marginBottom: 10, fontSize: 'var(--text-sm, 12px)',
              background: 'var(--win-bg, #c0c0c0)',
            }}>
              <div>Raw value (LMSR): <b>{preview.value_before_penalty.toFixed(2)} $NXT</b></div>
              <div>3% penalty: <b style={{ color: '#b71c1c' }}>
                -{preview.penalty_nxt.toFixed(2)} $NXT
              </b></div>
              <div style={{ marginTop: 2 }}>
                Net you receive: <b>~{Math.floor(preview.value_after_penalty)} $NXT</b>
                {' '}<span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  (floored)
                </span>
              </div>
              <div style={{
                marginTop: 4, padding: '2px 4px',
                background: preview.pnl >= 0 ? '#e8f5e9' : '#ffebee',
                color: preview.pnl >= 0 ? '#1b5e20' : '#b71c1c',
                fontWeight: 'bold',
              }}>
                P/L vs cost basis: {preview.pnl >= 0 ? '+' : ''}{preview.pnl.toFixed(2)} $NXT
              </div>
              {isPartial && (
                <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                  Remaining position: {remaining.toFixed(4)} shares
                </div>
              )}
            </div>
          )}

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
                padding: '4px 14px', fontWeight: 'bold', background: '#ffe082',
              }}
              disabled={sharesNum <= 0 || !wallet || stage === 'submitting'}>
              {stage === 'submitting' ? 'Exiting…' : 'Confirm Exit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
