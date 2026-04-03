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
  const { isConnected, chain } = useWallet();
  const isWrongChain = isConnected && chain?.id !== MEGAETH_CHAIN_ID;

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

  const [claimStep, setClaimStep] = useState('idle'); // idle | syncing | signing | mining | success | error
  const [claimError, setClaimError] = useState(null);

  useEffect(() => {
    if (isConfirmed) {
      setClaimStep('success');
      refetchPreview();
      onClaimed?.();
    }
  }, [isConfirmed, refetchPreview, onClaimed]);

  // Track writeContract pending → signing step
  useEffect(() => {
    if (isSending) setClaimStep('signing');
  }, [isSending]);
  useEffect(() => {
    if (isMining) setClaimStep('mining');
  }, [isMining]);

  const grossWei = preview ? BigInt(preview[0]) : BigInt(0);
  const feeWei = preview ? BigInt(preview[1]) : BigInt(0);
  const netWei = preview ? BigInt(preview[2]) : BigInt(0);
  const grossDisplay = formatNxt(grossWei);
  const feeDisplay = formatNxt(feeWei);
  const netDisplay = formatNxt(netWei);
  const hasClaimable = grossWei > BigInt(0);

  // Use game balance for fee estimate when nothing is on-chain yet
  const estimatedNet = gameBalance > 0 ? Math.floor(gameBalance * 0.9) : 0;
  const estimatedFee = gameBalance > 0 ? gameBalance - estimatedNet : 0;

  // ── Single CLAIM button: sync → wait → withdraw ──
  const handleClaim = async () => {
    setClaimStep('syncing');
    setClaimError(null);
    resetTx();

    // Step 1: Force sync to push in-game balance on-chain
    try {
      await api.forceClaimSync();
    } catch (e) {
      setClaimStep('error');
      setClaimError('Sync failed: ' + (e.message || 'unknown error'));
      return;
    }

    // Step 2: Wait for on-chain state to update, then re-read previewClaim
    await new Promise(r => setTimeout(r, 4000));
    let retries = 3;
    let claimable = false;
    while (retries > 0) {
      try {
        const { data: fresh } = await refetchPreview();
        if (fresh && BigInt(fresh[0]) > BigInt(0)) {
          claimable = true;
          break;
        }
      } catch {}
      retries--;
      if (retries > 0) await new Promise(r => setTimeout(r, 3000));
    }

    if (!claimable) {
      setClaimStep('error');
      setClaimError('Sync completed but balance not yet reflected on-chain. Try again in 1 minute.');
      return;
    }

    // Step 3: Call claimNXT via MetaMask
    setClaimStep('signing');
    try {
      writeContract({
        address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI,
        functionName: 'claimNXT', args: [ids],
      });
    } catch (e) {
      setClaimStep('error');
      setClaimError('Transaction rejected: ' + (e.message || 'unknown'));
    }
  };

  // ── Direct withdraw (already on-chain) ──
  const handleWithdrawDirect = () => {
    setClaimStep('signing');
    setClaimError(null);
    resetTx();
    writeContract({
      address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI,
      functionName: 'claimNXT', args: [ids],
    });
  };

  const handleRetry = () => {
    setClaimStep('idle');
    setClaimError(null);
  };

  const busy = claimStep !== 'idle' && claimStep !== 'success' && claimStep !== 'error';

  const box = {
    margin: '4px 8px', padding: '10px',
    border: '1px solid var(--border-dark)', background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
  };
  const card = {
    padding: '10px 12px', border: '1px solid var(--border-dark)',
    background: 'rgba(0,0,0,0.15)', marginBottom: '8px',
  };
  const row = { display: 'flex', justifyContent: 'space-between', padding: '2px 0' };

  return (
    <div style={box}>
      <div style={{ fontSize: '14px', color: 'var(--gold-on-grey, #7a5c00)', fontWeight: 'bold', marginBottom: '8px' }}>
        WITHDRAW $NXT TO WALLET
      </div>

      {/* Balance summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '13px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888' }}>In-Game</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)' }}>{formatNumber(gameBalance)} $NXT</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888' }}>On-Chain</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: hasClaimable ? 'var(--terminal-green)' : '#666' }}>{grossDisplay} $NXT</div>
        </div>
      </div>

      {/* ── No devs ── */}
      {ids.length === 0 && (
        <div style={{ ...card, fontSize: '12px', color: '#888' }}>
          No devs found. Mint a dev to start earning $NXT.
        </div>
      )}

      {/* ── No balance yet ── */}
      {ids.length > 0 && !gameBalance && !hasClaimable && (
        <div style={{ ...card, fontSize: '12px', color: '#888' }}>
          Your devs haven't earned $NXT yet. They earn 200 $NXT/day through salary.
        </div>
      )}

      {/* ── Claim card: has game balance OR on-chain claimable ── */}
      {ids.length > 0 && (gameBalance > 0 || hasClaimable) && claimEnabled !== false && (
        <div style={{ ...card, borderColor: hasClaimable ? 'rgba(0,180,0,0.3)' : 'rgba(122,92,0,0.3)' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)', marginBottom: '6px' }}>
            CLAIM $NXT
          </div>

          {/* Fee breakdown */}
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <div style={row}>
              <span style={{ color: '#888' }}>Amount to claim:</span>
              <span style={{ color: 'var(--gold-on-grey)' }}>
                {hasClaimable ? grossDisplay : formatNumber(gameBalance)} $NXT
              </span>
            </div>
            <div style={row}>
              <span style={{ color: '#888' }}>Protocol fee (10%):</span>
              <span style={{ color: 'var(--terminal-red, #ff4444)' }}>
                -{hasClaimable ? feeDisplay : formatNumber(estimatedFee)} $NXT
              </span>
            </div>
            <div style={{ ...row, borderTop: '1px solid var(--border-dark)', marginTop: '4px', paddingTop: '4px', fontSize: '14px' }}>
              <span style={{ color: '#ccc', fontWeight: 'bold' }}>You receive:</span>
              <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>
                {hasClaimable ? netDisplay : '~' + formatNumber(estimatedNet)} $NXT
              </span>
            </div>
          </div>

          {/* Wrong chain warning */}
          {isWrongChain && (
            <div style={{ fontSize: '12px', color: 'var(--terminal-red)', marginBottom: '6px' }}>
              Switch to MegaETH network to claim.
            </div>
          )}

          {/* Claim button */}
          {claimStep === 'idle' && (
            <button className="win-btn" onClick={hasClaimable ? handleWithdrawDirect : handleClaim}
              disabled={isWrongChain}
              style={{ padding: '5px 20px', fontWeight: 'bold', fontSize: '12px',
                background: isWrongChain ? undefined : '#2a5a00', color: isWrongChain ? undefined : '#fff',
                width: '100%', textAlign: 'center' }}>
              CLAIM {hasClaimable ? netDisplay : '~' + formatNumber(estimatedNet)} $NXT
            </button>
          )}

          {/* Syncing state */}
          {claimStep === 'syncing' && (
            <div style={{ textAlign: 'center', padding: '6px', color: 'var(--terminal-amber)', fontSize: '13px' }}>
              Syncing to blockchain...
            </div>
          )}

          {/* Signing state */}
          {claimStep === 'signing' && (
            <div style={{ textAlign: 'center', padding: '6px', color: 'var(--terminal-amber)', fontSize: '13px' }}>
              Sign in MetaMask...
            </div>
          )}

          {/* Mining state */}
          {claimStep === 'mining' && (
            <div style={{ textAlign: 'center', padding: '6px', color: 'var(--terminal-amber)', fontSize: '13px' }}>
              Transaction pending...
              {txHash && (
                <span>{' '}<a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline', fontSize: '11px' }}>View TX</a></span>
              )}
            </div>
          )}

          {/* Success */}
          {claimStep === 'success' && (
            <div style={{ textAlign: 'center', padding: '6px' }}>
              <div style={{ color: 'var(--terminal-green)', fontSize: '13px', fontWeight: 'bold' }}>
                Claimed!
              </div>
              {txHash && (
                <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline', fontSize: '11px' }}>
                  View transaction
                </a>
              )}
            </div>
          )}

          {/* Error */}
          {claimStep === 'error' && (
            <div style={{ textAlign: 'center', padding: '6px' }}>
              <div style={{ color: 'var(--terminal-red, #ff4444)', fontSize: '12px', marginBottom: '6px' }}>
                {claimError}
              </div>
              <button className="win-btn" onClick={handleRetry}
                style={{ fontSize: '11px', padding: '3px 14px' }}>
                Try Again
              </button>
            </div>
          )}

          {/* Note */}
          {claimStep === 'idle' && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
              Devs keep earning salary after withdrawal. Working capital rebuilds automatically.
            </div>
          )}
        </div>
      )}

      {/* Claiming disabled */}
      {claimEnabled === false && (
        <div style={{ ...card, borderColor: 'rgba(255,183,0,0.3)' }}>
          <div style={{ fontSize: '13px', color: 'var(--terminal-amber)' }}>Claiming will be enabled soon.</div>
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
