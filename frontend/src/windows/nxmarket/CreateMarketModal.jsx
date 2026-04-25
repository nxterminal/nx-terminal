import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useWallet } from '../../hooks/useWallet';


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
  const { connect } = useWallet();
  const isOfficial = mode === 'official';
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('crypto');
  const [closeAt, setCloseAt] = useState(isoMin(48));
  const [liquidityB, setLiquidityB] = useState(USER_DEFAULT_B);
  const [seedNxt, setSeedNxt] = useState(500);
  const [stage, setStage] = useState('idle'); // 'idle' | 'submitting' | 'error'
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cap, setCap] = useState(null); // escalera state for user markets

  // Fetch cap info for user mode. Official mode bypasses this since the
  // admin endpoint doesn't apply the escalera.
  useEffect(() => {
    if (!wallet || isOfficial) {
      setCap(null);
      return;
    }
    let cancelled = false;
    api.getUserCap(wallet)
      .then(c => { if (!cancelled) setCap(c); })
      .catch(() => { if (!cancelled) setCap(null); });
    return () => { cancelled = true; };
  }, [wallet, isOfficial]);

  const qLen = question.trim().length;
  const closeAtMs = closeAt ? new Date(closeAt).getTime() : 0;
  const minMs = Date.now() + 60 * 60 * 1000; // +1h
  const validQuestion = qLen >= 10 && qLen <= 200;
  const validClose = closeAtMs >= minMs;
  const validLiquidity = liquidityB >= 10 && liquidityB <= 10000;
  const validSeed = !isOfficial || (seedNxt >= 100 && seedNxt <= 10000);
  const capBlocks = !isOfficial && cap && !cap.can_create;
  const canSubmit = validQuestion && validClose && validLiquidity && validSeed
    && (isOfficial || confirmed) && stage === 'idle'
    && !capBlocks;

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
          <span>{isOfficial ? 'Create Official Market (Admin)' : 'Create Market — 1000 $NXT'}</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12, fontSize: 'var(--text-base)' }}>
          {!wallet && (
            <div style={{
              padding: 6, marginBottom: 8, background: '#fff3cd',
              border: '1px solid #856404', color: '#856404',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>Connect your wallet to create a market.</span>
              <button
                onClick={connect}
                className="win-btn"
                style={{ padding: '2px 10px', fontSize: 11, fontWeight: 'bold' }}
              >
                Connect Wallet
              </button>
            </div>
          )}

          {capBlocks && (
            <div style={{
              padding: 10, marginBottom: 10,
              background: '#ffebee', border: '2px solid #c62828',
              color: '#7a1d1d',
              fontFamily: "'VT323', monospace",
            }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'bold', marginBottom: 4 }}>
                ⚠ You've reached your market cap
              </div>
              <div style={{ fontSize: 'var(--text-sm, 12px)', marginBottom: 4 }}>
                Active markets: <b>{cap.active_markets} / {cap.max_markets}</b>
                {' · '}Current devs: <b>{cap.dev_count}</b>
              </div>
              <div style={{ fontSize: 'var(--text-sm, 12px)', marginTop: 6 }}>
                Ways to get more slots:
              </div>
              <ul style={{
                margin: '2px 0 0 18px', padding: 0, fontSize: 'var(--text-sm, 12px)',
                lineHeight: 1.4,
              }}>
                <li>Resolve or close existing markets</li>
                <li>Mint more devs: 5 devs → 5 slots, 20+ devs → unlimited</li>
              </ul>
            </div>
          )}

          {!isOfficial && cap && cap.can_create && cap.max_markets !== null && (
            <div style={{
              padding: 6, marginBottom: 10, background: '#fffde7',
              border: '1px solid #c7b86a', fontSize: 'var(--text-sm, 12px)',
              color: '#6e5a00',
            }}>
              You have <b>{cap.active_markets}/{cap.max_markets}</b> active
              user markets. After creating this one:{' '}
              <b>{cap.active_markets + 1}/{cap.max_markets}</b>.
              {cap.max_markets < 5 && (
                <> Mint more devs to raise your cap.</>
              )}
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
                I understand creating this market costs <b>1000 $NXT</b>,
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
              disabled={!canSubmit || !wallet}
              title={
                !wallet ? 'Connect your wallet to create a market'
                : capBlocks ? `Cap reached: ${cap.active_markets}/${cap.max_markets} active. Mint more devs or resolve existing markets.`
                : !validQuestion ? 'Question must be 10-200 chars'
                : !validClose ? 'close_at must be at least 1h in the future'
                : undefined
              }>
              {stage === 'submitting'
                ? 'Creating…'
                : isOfficial ? 'Create (free)' : 'Create (1000 $NXT)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
