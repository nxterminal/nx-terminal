import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import { useDevs } from '../contexts/DevsContext';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, EXPLORER_BASE, MEGAETH_CHAIN_ID } from '../services/contract';

const RARITY_COLORS = {
  common: 'var(--common-on-grey, #333333)', uncommon: 'var(--green-on-grey, #005500)', rare: 'var(--blue-on-grey, #0d47a1)',
  legendary: 'var(--gold-on-grey, #7a5c00)', mythic: 'var(--pink-on-grey, #660066)',
};

const MOVEMENT_ICONS = { salary: '+', sell: '+', spend: '-', shop: '-', claim: '-' };
const MOVEMENT_COLORS_GREY = {
  salary: 'var(--green-on-grey)', sell: 'var(--green-on-grey)',
  spend: 'var(--red-on-grey)', shop: 'var(--red-on-grey)', claim: 'var(--red-on-grey)',
};

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function formatNxt(wei) {
  if (!wei) return '0';
  const n = Number(formatUnits(BigInt(wei), 18));
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Loading Bar ──────────────────────────────────────────
function LoadingBar() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + Math.random() * 15, 95)), 300);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: "'VT323', monospace", color: 'var(--terminal-green)',
      background: 'var(--terminal-bg)', gap: '8px',
    }}>
      <div style={{ fontSize: '14px' }}>{'>'} Loading wallet data...</div>
      <div style={{ width: '200px', height: '12px', border: '1px solid var(--border-dark)', background: '#111' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--terminal-green)', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '11px', color: '#888' }}>{Math.round(progress)}%</div>
    </div>
  );
}

// ── Withdraw Section (On-Chain) ──────────────────────────
function WithdrawSection({ wallet, tokenIds, gameBalance, onClaimed }) {
  const ids = tokenIds ? Array.from(tokenIds).map(id => BigInt(id)) : [];

  const { data: claimEnabled } = useReadContract({
    address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI, functionName: 'claimEnabled',
    chainId: MEGAETH_CHAIN_ID, query: { enabled: !!wallet },
  });

  const { data: preview, refetch: refetchPreview } = useReadContract({
    address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI, functionName: 'previewClaim',
    args: [ids], chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!wallet && ids.length > 0 },
  });

  const { data: txHash, writeContract, isPending: isSending, reset: resetTx } = useWriteContract();
  const { isLoading: isMining, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Sync status
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const fetchSyncStatus = useCallback(async () => {
    try { setSyncStatus(await api.getClaimSyncStatus()); } catch {}
  }, []);

  useEffect(() => { fetchSyncStatus(); }, [fetchSyncStatus]);

  useEffect(() => {
    if (isConfirmed) { refetchPreview(); onClaimed?.(); }
  }, [isConfirmed, refetchPreview, onClaimed]);

  const handleForceSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await api.forceClaimSync();
      setSyncStatus(result);
      setSyncMsg(result.last_result || 'Sync executed');
      // Refresh on-chain preview after sync
      setTimeout(() => refetchPreview(), 3000);
    } catch (e) {
      setSyncMsg('Sync failed: ' + (e.message || 'unknown'));
    }
    setSyncing(false);
  };

  const grossWei = preview ? BigInt(preview[0]) : BigInt(0);
  const feeWei = preview ? BigInt(preview[1]) : BigInt(0);
  const netWei = preview ? BigInt(preview[2]) : BigInt(0);
  const grossDisplay = formatNxt(grossWei);
  const feeDisplay = formatNxt(feeWei);
  const netDisplay = formatNxt(netWei);
  const hasClaimable = grossWei > BigInt(0);

  const handleWithdraw = () => {
    resetTx();
    writeContract({
      address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI,
      functionName: 'claimNXT', args: [ids],
    });
  };

  const box = {
    margin: '4px 8px', padding: '10px',
    border: '1px solid var(--border-dark)', background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
  };
  const card = {
    padding: '8px 10px', border: '1px solid var(--border-dark)',
    background: 'rgba(0,0,0,0.15)', marginBottom: '8px',
  };
  const lbl = { fontSize: '11px', color: '#888', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' };

  const isDryRun = syncStatus?.dry_run;

  return (
    <div style={box}>
      <div style={{ fontSize: '14px', color: 'var(--gold-on-grey, #7a5c00)', fontWeight: 'bold', marginBottom: '8px' }}>
        WITHDRAW $NXT TO WALLET
      </div>

      {/* ── Pipeline: In-Game → On-Chain → Wallet ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '10px', fontSize: '13px' }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: 'rgba(122,92,0,0.08)', border: '1px solid rgba(122,92,0,0.2)' }}>
          <div style={lbl}>In-Game</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)' }}>{formatNumber(gameBalance)}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>your devs</div>
        </div>
        <div style={{ padding: '0 4px', color: '#555', fontSize: '16px' }}>{'\u2192'}</div>
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: hasClaimable ? 'rgba(0,180,0,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hasClaimable ? 'rgba(0,180,0,0.2)' : 'var(--border-dark)'}` }}>
          <div style={lbl}>On-Chain</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: hasClaimable ? 'var(--terminal-green)' : '#666' }}>{grossDisplay}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>ready</div>
        </div>
        <div style={{ padding: '0 4px', color: '#555', fontSize: '16px' }}>{'\u2192'}</div>
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dark)' }}>
          <div style={lbl}>Your Wallet</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#666' }}>-</div>
          <div style={{ fontSize: '10px', color: '#666' }}>claimed</div>
        </div>
      </div>

      {/* ── Sync to Blockchain card ── */}
      {!hasClaimable && gameBalance > 0 && claimEnabled !== false && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--terminal-amber)' }}>SYNC TO BLOCKCHAIN</span>
            <span style={{ fontSize: '11px', color: syncStatus?.last_sync_at ? 'var(--terminal-green)' : '#888' }}>
              {syncStatus?.last_sync_at ? '\u25CF Active' : '\u25CB Awaiting first sync'}
            </span>
          </div>

          {isDryRun && (
            <div style={{ fontSize: '11px', color: 'var(--terminal-red, #ff4444)', padding: '3px 6px', marginBottom: '6px',
              border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.05)' }}>
              DRY_RUN mode active. Set DRY_RUN=false to push balances on-chain.
            </div>
          )}

          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
            Your {formatNumber(gameBalance)} $NXT syncs to blockchain automatically every ~5 min.
            {syncStatus?.last_sync_at && (
              <span style={{ color: '#666' }}> Last: {new Date(syncStatus.last_sync_at).toLocaleTimeString()}</span>
            )}
            {syncStatus?.last_result && (
              <span style={{ color: '#666' }}> ({syncStatus.last_result})</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="win-btn" onClick={handleForceSync} disabled={syncing}
              style={{ fontSize: '11px', padding: '3px 14px', fontWeight: 'bold' }}>
              {syncing ? 'Syncing...' : '\u26A1 Sync Now'}
            </button>
            {syncMsg && (
              <span style={{ fontSize: '11px', color: syncMsg.includes('fail') || syncMsg.includes('error') ? 'var(--terminal-red)' : 'var(--terminal-green)' }}>
                {syncMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Claiming disabled ── */}
      {claimEnabled === false && (
        <div style={{ ...card, borderColor: 'rgba(255,183,0,0.3)' }}>
          <div style={{ fontSize: '13px', color: 'var(--terminal-amber)' }}>Claiming will be enabled soon.</div>
        </div>
      )}

      {/* ── Withdraw card (has claimable on-chain) ── */}
      {hasClaimable && claimEnabled !== false && (
        <div style={{ ...card, borderColor: 'rgba(0,180,0,0.3)' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--terminal-green)', marginBottom: '6px' }}>
            WITHDRAW
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0' }}>
            <span style={{ color: '#888' }}>Available:</span>
            <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>{grossDisplay} $NXT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
            <span style={{ color: '#888' }}>Claim fee (10%):</span>
            <span style={{ color: 'var(--terminal-red, #ff4444)' }}>-{feeDisplay} $NXT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '4px 0 6px', borderTop: '1px solid var(--border-dark)', marginTop: '4px' }}>
            <span style={{ color: '#ccc', fontWeight: 'bold' }}>You receive:</span>
            <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>{netDisplay} $NXT</span>
          </div>

          <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
            After withdrawal, devs keep earning 200 $NXT/day. New salary rebuilds capital.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="win-btn" disabled={isSending || isMining} onClick={handleWithdraw}
              style={{ padding: '4px 16px', fontWeight: 'bold', fontSize: '12px',
                background: isSending || isMining ? undefined : '#2a5a00',
                color: isSending || isMining ? undefined : '#fff' }}>
              {isSending ? 'SENDING...' : isMining ? 'MINING...' : `WITHDRAW ${netDisplay} $NXT`}
            </button>

            {txHash && !isConfirmed && (
              <span style={{ fontSize: '12px', color: 'var(--terminal-amber)' }}>
                TX pending...{' '}
                <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}>View</a>
              </span>
            )}
            {isConfirmed && (
              <span style={{ fontSize: '12px', color: 'var(--terminal-green)' }}>
                Withdrawn! <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}>View TX</a>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Withdraw card (nothing available yet) ── */}
      {!hasClaimable && claimEnabled !== false && !(gameBalance > 0) && ids.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>WITHDRAW</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            Your devs haven't earned $NXT yet. They earn 200 $NXT/day through salary.
          </div>
        </div>
      )}

      {/* ── No devs ── */}
      {ids.length === 0 && claimEnabled !== false && (
        <div style={card}>
          <div style={{ fontSize: '12px', color: '#888' }}>
            No devs found. Mint a dev to start earning $NXT.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Balance Tab ───────────────────────────────────────────
function BalanceTab({ summary, wallet, tokenIds, history, onClaimed }) {
  if (!summary) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Section 1: Game Balance */}
      <div style={{
        padding: '4px 8px', margin: '4px 8px 0',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-amber)', fontWeight: 'bold',
      }}>
        {'>'} GAME BALANCE (Virtual)
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">Balance</div>
          <div className="stat-value" style={{ color: 'var(--gold-on-grey)' }}>{formatNumber(summary.balance_claimable)}</div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value" style={{ color: 'var(--red-on-grey)' }}>{formatNumber(summary.total_spent || summary.balance_claimed || 0)}</div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: 'var(--cyan-on-grey)' }}>{formatNumber(summary.balance_total_earned)}</div>
          <div className="stat-label">$NXT</div>
        </div>
      </div>

      {/* Salary info */}
      <div style={{
        padding: '4px 8px', margin: '0 8px',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-green)', background: 'var(--terminal-bg)',
      }}>
        {'>'} Salary: <span style={{ color: 'var(--gold)' }}>200 $NXT/day</span> per dev
        {' \u00D7 '}{summary.total_devs} devs = <span style={{ color: 'var(--gold)' }}>{formatNumber(summary.salary_per_day)} $NXT/day</span>
      </div>

      <div style={{
        padding: '4px 8px', margin: '2px 8px',
        fontFamily: "'VT323', monospace", fontSize: '11px', color: 'var(--text-muted, #888)',
      }}>
        This is what your devs have earned in-game. Syncs to blockchain periodically.
      </div>

      {/* Per-dev table */}
      <div className="win-panel" style={{ overflow: 'auto', margin: '2px 4px', maxHeight: '140px' }}>
        <table className="win-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Rarity</th><th>Balance</th><th>Earned</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(summary.devs || []).map(dev => (
              <tr key={dev.token_id}>
                <td>#{dev.token_id}</td>
                <td style={{ fontWeight: 'bold' }}>{dev.name}</td>
                <td>
                  <span style={{ color: RARITY_COLORS[(dev.rarity_tier || '').toLowerCase()] || 'var(--text-primary)' }}>
                    {dev.rarity_tier}
                  </span>
                </td>
                <td style={{ color: 'var(--gold-on-grey)' }}>{formatNumber(dev.balance_nxt)}</td>
                <td>{formatNumber(dev.total_earned)}</td>
                <td>{dev.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Balance chart */}
      <BalanceBarChart history={history} summary={summary} />

      {/* Withdraw section */}
      <WithdrawSection wallet={wallet} tokenIds={tokenIds} gameBalance={summary.balance_claimable} onClaimed={onClaimed} />
    </div>
  );
}

// ── Balance Delta Chart (daily change) ─────────────────────
function BalanceBarChart({ history, summary }) {
  const raw = (history || []).map(s => ({
    date: formatDate(s.snapshot_date),
    balance: Number(s.balance_claimable),
  }));

  if (raw.length === 0 && summary) {
    raw.push({ date: formatDate(new Date().toISOString().slice(0, 10)), balance: Number(summary.balance_claimable) || 0 });
  }
  if (raw.length < 2) return null;

  const data = [];
  for (let i = 1; i < raw.length; i++) {
    data.push({ date: raw[i].date, delta: raw[i].balance - raw[i - 1].balance });
  }
  if (data.length === 0) return null;

  const totalUp = data.filter(d => d.delta > 0).reduce((s, d) => s + d.delta, 0);
  const totalDown = data.filter(d => d.delta < 0).reduce((s, d) => s + Math.abs(d.delta), 0);

  const W = 600, H = 120;
  const PAD = { top: 8, right: 8, bottom: 18, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const absValues = data.map(d => Math.abs(d.delta));
  const maxAbs = Math.max(...absValues) || 1;
  const halfH = chartH / 2;
  const midY = PAD.top + halfH;
  const barGap = 1;
  const barWidth = Math.max(2, (chartW / data.length) - barGap);
  const labelInterval = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ margin: '4px 8px', padding: '0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px', fontFamily: "'VT323', monospace", fontSize: '13px',
        background: 'var(--terminal-bg)',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>{'>'} Daily Change (30d)</span>
        <span>
          <span style={{ color: '#00c853' }}>{'\u25B2'} +{formatNumber(totalUp)}</span>
          {' '}
          <span style={{ color: '#ef5350' }}>{'\u25BC'} -{formatNumber(totalDown)}</span>
        </span>
      </div>
      <div className="protocol-chart" style={{ width: '100%', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke="#555" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={PAD.top + 4} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            +{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>
          <text x={PAD.left - 4} y={midY + 3} fill="#666" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">0</text>
          <text x={PAD.left - 4} y={PAD.top + chartH + 2} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            -{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>
          {data.map((d, i) => {
            const x = PAD.left + (i / data.length) * chartW + barGap / 2;
            const isPositive = d.delta >= 0;
            const barH = Math.max(2, (Math.abs(d.delta) / maxAbs) * halfH);
            const y = isPositive ? midY - barH : midY;
            const fill = isPositive ? '#00c853' : '#ef5350';
            return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={fill} opacity={0.75} rx={1} />;
          })}
          {data.map((d, i) => (
            i % labelInterval === 0 ? (
              <text key={i} x={PAD.left + (i / data.length) * chartW + barWidth / 2} y={H - 2}
                fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="middle">{d.date}</text>
            ) : null
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Movements Bar Chart (income/expense bars) ───────────────
function MovementsChart({ movements, summary }) {
  if (!movements || movements.length === 0 || !summary) return null;
  const now = new Date();
  const todayStr = now.toDateString();
  const todayMovements = movements.filter(m => new Date(m.timestamp).toDateString() === todayStr).reverse();
  if (todayMovements.length === 0) return null;

  const data = todayMovements.map(m => ({
    label: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    amount: Number(m.amount) || 0, type: m.type,
  }));
  const totalIn = data.filter(d => d.amount > 0).reduce((s, d) => s + d.amount, 0);
  const totalOut = data.filter(d => d.amount < 0).reduce((s, d) => s + Math.abs(d.amount), 0);

  const W = 600, H = 130;
  const PAD = { top: 8, right: 8, bottom: 18, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const absValues = data.map(d => Math.abs(d.amount));
  const maxAbs = Math.max(...absValues) || 1;
  const halfH = chartH / 2;
  const midY = PAD.top + halfH;
  const barGap = 2;
  const barWidth = Math.max(4, (chartW / data.length) - barGap);
  const labelInterval = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ padding: '4px 4px 0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px', fontFamily: "'VT323', monospace", fontSize: '13px',
      }}>
        <span style={{ color: '#888' }}>Today's Activity</span>
        <span>
          <span style={{ color: '#00c853' }}>{'\u25B2'} +{formatNumber(totalIn)}</span>
          {' '}
          <span style={{ color: '#ef5350' }}>{'\u25BC'} -{formatNumber(totalOut)}</span>
        </span>
      </div>
      <div className="protocol-chart" style={{ width: '100%', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke="#555" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={PAD.top + 4} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            +{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>
          <text x={PAD.left - 4} y={midY + 3} fill="#666" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">0</text>
          <text x={PAD.left - 4} y={PAD.top + chartH + 2} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            -{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>
          {data.map((d, i) => {
            const x = PAD.left + (i / data.length) * chartW + barGap / 2;
            const isPositive = d.amount >= 0;
            const barH = Math.max(2, (Math.abs(d.amount) / maxAbs) * halfH);
            const y = isPositive ? midY - barH : midY;
            const fill = isPositive ? '#00c853' : '#ef5350';
            return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={fill} opacity={0.75} rx={1} />;
          })}
          {data.map((d, i) => (
            i % labelInterval === 0 ? (
              <text key={i} x={PAD.left + (i / data.length) * chartW + barWidth / 2} y={H - 2}
                fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="middle">{d.label}</text>
            ) : null
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Movements Tab ─────────────────────────────────────────
function MovementsTab({ movements, summary }) {
  if (!movements || movements.length === 0) return (
    <div style={{
      padding: '24px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: '28px' }}>$</div>
      <div>{'> No movements yet.'}</div>
      <div style={{ fontSize: '12px', color: '#888' }}>
        Your devs' earnings and spending will appear here.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MovementsChart movements={movements} summary={summary} />
      <div className="win-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="win-table">
          <thead>
            <tr><th style={{ width: '24px' }}></th><th>Type</th><th>Description</th><th>Amount</th><th>Dev</th><th>Date</th></tr>
          </thead>
          <tbody>
            {movements.map((m, i) => (
              <tr key={i}>
                <td style={{ color: MOVEMENT_COLORS_GREY[m.type] || '#888', fontWeight: 'bold', textAlign: 'center', fontSize: '13px' }}>
                  {MOVEMENT_ICONS[m.type] || '?'}
                </td>
                <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{m.type}</td>
                <td style={{ fontSize: '10px', whiteSpace: 'normal' }}>{m.description}</td>
                <td style={{ color: m.amount >= 0 ? 'var(--green-on-grey)' : 'var(--red-on-grey)', fontWeight: 'bold' }}>
                  {m.amount >= 0 ? '+' : ''}{formatNumber(m.amount)} $NXT
                </td>
                <td style={{ fontSize: '10px' }}>{m.dev_name || (m.dev_id ? `#${m.dev_id}` : '-')}</td>
                <td style={{ fontSize: '10px' }}>{formatTimestamp(m.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function NxtWallet() {
  const [tab, setTab] = useState('balance');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const lastGoodRef = useRef({ summary: null, history: [], movements: [] });

  const { address, isConnected, displayAddress } = useWallet();
  const wallet = isConnected ? address : null;
  const { tokenIds: contextTokenIds } = useDevs();
  const tokenIds = contextTokenIds.length > 0 ? contextTokenIds.map(BigInt) : undefined;

  // ── Single fetch function — never triggers loading flash ──
  const fetchAll = useCallback(async () => {
    if (!wallet) return;
    try {
      const [sum, hist, mov] = await Promise.allSettled([
        api.getWalletSummary(wallet),
        api.getBalanceHistory(wallet),
        api.getMovements(wallet),
      ]);
      if (sum.status === 'fulfilled' && sum.value) {
        lastGoodRef.current.summary = sum.value;
        setSummary(sum.value);
      }
      if (hist.status === 'fulfilled' && Array.isArray(hist.value)) {
        lastGoodRef.current.history = hist.value;
        setHistory(hist.value);
      }
      if (mov.status === 'fulfilled' && Array.isArray(mov.value)) {
        lastGoodRef.current.movements = mov.value;
        setMovements(mov.value);
      }
    } catch {
      // Keep last good data on total failure
      if (lastGoodRef.current.summary) setSummary(lastGoodRef.current.summary);
    } finally {
      setIsFirstLoad(false);
    }
  }, [wallet]);

  // ── Load on mount + auto-refresh every 90s ──
  useEffect(() => {
    if (!wallet) {
      setSummary(null);
      setHistory([]);
      setMovements([]);
      setIsFirstLoad(false);
      return;
    }
    setIsFirstLoad(true);
    fetchAll();
    const interval = setInterval(fetchAll, 90_000);
    return () => clearInterval(interval);
  }, [wallet, fetchAll]);

  // ── Safety timeout: never stuck in loading ──
  useEffect(() => {
    if (!isFirstLoad) return;
    const t = setTimeout(() => setIsFirstLoad(false), 10_000);
    return () => clearTimeout(t);
  }, [isFirstLoad]);

  // ── UI States ──
  if (!isConnected) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'VT323', monospace", color: 'var(--terminal-amber)',
        background: 'var(--terminal-bg)', gap: '8px',
      }}>
        <div style={{ fontSize: '28px' }}>$</div>
        <div>{'> Connect wallet to view your $NXT balance'}</div>
      </div>
    );
  }

  if (isFirstLoad && !summary) {
    return <LoadingBar />;
  }

  if (!summary) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'VT323', monospace", color: 'var(--terminal-green)',
        background: 'var(--terminal-bg)', gap: '8px',
      }}>
        <div style={{ fontSize: '28px' }}>+</div>
        <div>{'> No devs yet. Mint your first developer to start earning $NXT!'}</div>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Each dev earns 200 $NXT/day. Open Mint/Hire Devs to get started.
        </div>
        <button className="win-btn" onClick={fetchAll} style={{ marginTop: '8px', padding: '4px 16px', fontSize: '11px' }}>
          Retry
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'balance', label: 'Balance' },
    { id: 'movements', label: 'Movements' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar with refresh button */}
      <div className="win-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {tabs.map(t => (
            <button key={t.id} className={`win-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <button className="win-btn" onClick={fetchAll}
          style={{ fontSize: '10px', padding: '1px 6px', marginRight: '4px' }}
          title="Refresh wallet data"
        >
          {'\u21bb'} Refresh
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'balance' && (
          <BalanceTab summary={summary} wallet={wallet} tokenIds={tokenIds} history={history} onClaimed={fetchAll} />
        )}
        {tab === 'movements' && (
          <MovementsTab movements={movements} summary={summary} />
        )}
      </div>

      {/* Status bar */}
      <div className="win98-statusbar" style={{ fontSize: '10px', color: '#555' }}>
        {displayAddress} | Salary: 200 $NXT/day per dev
      </div>
    </div>
  );
}
