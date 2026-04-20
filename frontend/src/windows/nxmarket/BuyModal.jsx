import { useMemo, useState } from 'react';
import { api } from '../../services/api';
import { calculateCostToBuy, calculatePrice } from '../../utils/lmsr';

export default function BuyModal({ market, side, wallet, onClose, onBought }) {
  const [amount, setAmount] = useState('10');
  const [stage, setStage] = useState('idle'); // 'idle' | 'submitting'
  const [error, setError] = useState(null);

  const amountNum = Math.floor(Number(amount) || 0);

  // Live LMSR preview matching the backend's response.
  const preview = useMemo(() => {
    if (amountNum < 1) return null;
    try {
      const cost = calculateCostToBuy(
        market.shares_yes, market.shares_no, market.liquidity_b,
        side, amountNum,
      );
      const newPrices = calculatePrice(
        cost.new_shares_yes, cost.new_shares_no, market.liquidity_b,
      );
      return {
        shares_received: cost.shares_received,
        average_price: cost.average_price,
        new_price_yes: newPrices.price_yes,
        new_price_no: newPrices.price_no,
      };
    } catch {
      return null;
    }
  }, [amountNum, market, side]);

  const submit = async () => {
    if (amountNum < 1 || stage === 'submitting') return;
    setStage('submitting');
    setError(null);
    try {
      const r = await api.buyShares(market.id, {
        wallet, side, amount_nxt: amountNum,
      });
      onBought && onBought(r);
    } catch (e) {
      setError(e.message || 'Buy failed');
      setStage('idle');
    }
  };

  const isYes = side === 'YES';
  const accent = isYes ? '#1b5e20' : '#b71c1c';

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
          <span>Buy {side}</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12, fontSize: 'var(--text-base)' }}>
          <div style={{
            padding: 8, marginBottom: 10, color: accent,
            background: isYes ? '#e8f5e9' : '#ffebee',
            border: `2px solid ${accent}`,
            fontSize: 'var(--text-lg, 16px)', fontWeight: 'bold',
            textAlign: 'center',
          }}>
            Buying {side} at {(isYes ? market.price_yes : market.price_no || 0).toFixed(2)}
          </div>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Amount $NXT (integer):
            </div>
            <input type="number" min={1} step={1} value={amount}
              onChange={e => setAmount(e.target.value)}
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
              <div>You'll receive ~<b>{preview.shares_received.toFixed(4)}</b> shares</div>
              <div>Avg price: <b>{preview.average_price.toFixed(4)}</b></div>
              <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                After trade — YES <b>{preview.new_price_yes.toFixed(4)}</b>{' '}
                / NO <b>{preview.new_price_no.toFixed(4)}</b>
              </div>
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
                padding: '4px 14px', fontWeight: 'bold',
                background: isYes ? '#a5d6a7' : '#ef9a9a',
              }}
              disabled={amountNum < 1 || !wallet || stage === 'submitting'}>
              {stage === 'submitting' ? 'Buying…' : `Confirm Buy ${side}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
