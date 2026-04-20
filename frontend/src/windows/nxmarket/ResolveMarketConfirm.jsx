import { useState } from 'react';
import { api } from '../../services/api';

// Minimal admin resolve confirmation. The double-confirmation UI
// (typed keyword + checkbox) lives here too so the same component
// covers the whole flow; commit 4 expands the preview block but the
// safety gate is in place from commit 3 onwards.

export default function ResolveMarketConfirm({
  market, resolution, wallet, onClose, onResolved,
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [typed, setTyped] = useState('');
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);

  const canSubmit = confirmed && typed.trim().toUpperCase() === 'RESOLVE'
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
          <span>⚠ RESOLVE MARKET — IRREVERSIBLE</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>

        <div style={{ padding: 12 }}>
          <div style={{
            fontSize: 'var(--text-lg, 16px)', fontWeight: 'bold',
            marginBottom: 8, textAlign: 'center',
          }}>
            Resolve market #{market.id} as '{resolution}'?
          </div>
          <div className="win-panel" style={{
            padding: 8, marginBottom: 10, background: 'var(--win-bg, #c0c0c0)',
          }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              {market.question}
            </div>
          </div>

          <label style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input type="checkbox" checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)} />
            <span style={{ fontSize: 'var(--text-sm, 12px)' }}>
              I confirm this resolution is correct and final.
            </span>
          </label>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-sm, 12px)', color: 'var(--text-secondary)' }}>
              Type "RESOLVE" to confirm:
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
              {stage === 'submitting' ? 'Resolving…' : 'Confirm Resolution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
