import { useState } from 'react';
import { api } from '../../services/api';


function isoMin(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  // datetime-local needs YYYY-MM-DDTHH:MM (no seconds, no Z).
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


// Users don't need to configure LMSR b parameter — too technical.
// Default 100 works well for most markets. Admins can still tune
// it when creating official markets.
const USER_DEFAULT_B = 100;


export default function CreateMarketModal({ mode, wallet, onClose, onCreated }) {
  const isOfficial = mode === 'official';
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('crypto');
  const [closeAt, setCloseAt] = useState(isoMin(48));
  const [liquidityB, setLiquidityB] = useState(USER_DEFAULT_B);
  const [seedNxt, setSeedNxt] = useState(500);
  const [stage, setStage] = useState('idle'); // 'idle' | 'submitting' | 'error'
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const qLen = question.trim().length;
  const closeAtMs = closeAt ? new Date(closeAt).getTime() : 0;
  const minMs = Date.now() + 60 * 60 * 1000; // +1h
  const validQuestion = qLen >= 10 && qLen <= 200;
  const validClose = closeAtMs >= minMs;
  const validLiquidity = liquidityB >= 10 && liquidityB <= 10000;
  const validSeed = !isOfficial || (seedNxt >= 100 && seedNxt <= 10000);
  const canSubmit = validQuestion && validClose && validLiquidity && validSeed
    && (isOfficial || confirmed) && stage === 'idle';

  const submit = async () => {
    if (!canSubmit) return;
    setStage('submitting');
    setError(null);
    try {
      const closeIso = new Date(closeAt).toISOString();
      if (isOfficial) {
        await api.createOfficialMarket(wallet, {
          question: question.trim(),
          category,
          close_at: closeIso,
          liquidity_b: liquidityB,
          seed_nxt: seedNxt,
        });
      } else {
        await api.createUserMarket({
          wallet,
          question: question.trim(),
          category,
          close_at: closeIso,
          liquidity_b: liquidityB,
        });
      }
      onCreated && onCreated();
    } catch (e) {
      setError(e.message || 'Failed to create market');
      setStage('idle');
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10020,
    }}>
      <div onClick={e => e.stopPropagation()} className="win-raised" style={{
        width: 460, maxWidth: '95vw', background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{isOfficial ? 'Create Official Market (Admin)' : 'Create Market — 500 $NXT'}</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12, fontSize: 'var(--text-base)' }}>
          {!wallet && (
            <div style={{
              padding: 6, marginBottom: 8, background: '#fff3cd',
              border: '1px solid #856404', color: '#856404',
            }}>
              Connect your wallet to create a market.
            </div>
          )}

          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Question (10-200 chars):
            </div>
            <textarea
              value={question} onChange={e => setQuestion(e.target.value)}
              maxLength={200} rows={2} placeholder="Will…?"
              style={{
                width: '100%', padding: 4, fontFamily: "'VT323', monospace",
                fontSize: 'var(--text-base)', background: '#fff',
                border: '2px inset #888', boxSizing: 'border-box',
              }} />
            <div style={{ fontSize: 'var(--text-xs, 11px)', color: 'var(--text-secondary)' }}>
              {qLen}/200{!validQuestion && qLen > 0 && ' — too short'}
            </div>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Category:
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{
                fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
                padding: 2,
              }}>
              <option value="crypto">crypto</option>
              <option value="sports">sports</option>
              <option value="politics">politics</option>
              <option value="entertainment">entertainment</option>
              <option value="other">other</option>
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Closes at (≥ 1h from now, ≤ 90 days):
            </div>
            <input type="datetime-local" value={closeAt}
              min={isoMin(1)} max={isoMin(24 * 90)}
              onChange={e => setCloseAt(e.target.value)}
              style={{
                fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
                padding: 2,
              }} />
            {!validClose && (
              <div style={{ fontSize: 'var(--text-xs, 11px)', color: '#b71c1c' }}>
                Must be at least 1 hour in the future
              </div>
            )}
          </label>

          {/* Liquidity b exposed to admins only. User markets use the
              constant USER_DEFAULT_B — see rationale above. */}
          {isOfficial && (
            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
                Liquidity b:
                {' '}<span style={{ fontSize: 'var(--text-xs, 11px)' }}>
                  (higher = more stable, lower = more volatile)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={10} max={10000} step={10}
                  value={liquidityB}
                  onChange={e => setLiquidityB(Number(e.target.value))}
                  style={{ flex: 1 }} />
                <input type="number" min={10} max={10000} step={10}
                  value={liquidityB}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setLiquidityB(v);
                  }}
                  onBlur={e => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v) || v < 10) setLiquidityB(10);
                    else if (v > 10000) setLiquidityB(10000);
                  }}
                  style={{
                    width: 78, padding: '2px 4px',
                    fontFamily: "'VT323', monospace",
                    fontSize: 'var(--text-base)',
                    background: '#fff', border: '2px inset #888',
                    boxSizing: 'border-box', textAlign: 'right',
                  }} />
              </div>
              {!validLiquidity && (
                <div style={{ fontSize: 'var(--text-xs, 11px)', color: '#b71c1c' }}>
                  Must be between 10 and 10,000
                </div>
              )}
            </label>
          )}

          {isOfficial && (
            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
                Seed $NXT (auto-minted): <b>{seedNxt}</b>
              </div>
              <input type="range" min={100} max={10000} step={50}
                value={seedNxt} onChange={e => setSeedNxt(Number(e.target.value))}
                style={{ width: '100%' }} />
            </label>
          )}

          {!isOfficial && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              marginBottom: 10, fontSize: 'var(--text-sm, 12px)',
            }}>
              <input type="checkbox" checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)} />
              <span>
                I understand creating this market costs <b>500 $NXT</b>,
                deducted from my in-game balance.
              </span>
            </label>
          )}

          {error && (
            <div style={{
              padding: 6, marginBottom: 8, background: '#ffebee',
              color: '#b71c1c', border: '1px solid #c62828',
              fontSize: 'var(--text-sm, 12px)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="win-btn"
              style={{ padding: '4px 12px' }}
              disabled={stage === 'submitting'}>
              Cancel
            </button>
            <button onClick={submit} className="win-btn"
              style={{ padding: '4px 12px', fontWeight: 'bold' }}
              disabled={!canSubmit || !wallet}>
              {stage === 'submitting'
                ? 'Creating…'
                : isOfficial ? 'Create (free)' : 'Create (500 $NXT)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
