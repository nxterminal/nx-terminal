import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, EXPLORER_BASE } from '../services/contract';

const RARITY_COLORS = {
  common: 'var(--common-on-grey, #333333)', uncommon: 'var(--green-on-grey, #005500)', rare: 'var(--blue-on-grey, #0d47a1)',
  legendary: 'var(--gold-on-grey, #7a5c00)', mythic: 'var(--pink-on-grey, #660066)',
};

const MOVEMENT_ICONS = {
  salary: '+',
  sell: '+',
  spend: '-',
  shop: '-',
  claim: '-',
};

// Colors safe for grey (win-panel) backgrounds
const MOVEMENT_COLORS_GREY = {
  salary: 'var(--green-on-grey)',
  sell: 'var(--green-on-grey)',
  spend: 'var(--red-on-grey)',
  shop: 'var(--red-on-grey)',
  claim: 'var(--red-on-grey)',
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
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Claim Section (On-Chain) ─────────────────────────────
function ClaimSection({ wallet, tokenIds }) {
  const ids = tokenIds ? Array.from(tokenIds).map(id => BigInt(id)) : [];

  // Read claimEnabled
  const { data: claimEnabled } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'claimEnabled',
    query: { enabled: !!wallet },
  });

  // Read previewClaim to get gross/fee/net
  const { data: preview, refetch: refetchPreview } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'previewClaim',
    args: [ids],
    query: { enabled: !!wallet && ids.length > 0 },
  });

  // Write: claimNXT
  const { data: txHash, writeContract, isPending: isSending, reset: resetTx } = useWriteContract();

  // Wait for TX receipt
  const { isLoading: isMining, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // After successful claim, refetch preview
  useEffect(() => {
    if (isConfirmed) {
      refetchPreview();
    }
  }, [isConfirmed, refetchPreview]);

  const netWei = preview ? preview[2] : BigInt(0);
  const netDisplay = formatNxt(netWei);
  const hasClaimable = netWei > BigInt(0);

  const handleClaim = () => {
    resetTx();
    writeContract({
      address: NXDEVNFT_ADDRESS,
      abi: NXDEVNFT_ABI,
      functionName: 'claimNXT',
      args: [ids],
    });
  };

  const claimDisabled = !claimEnabled || !hasClaimable || isSending || isMining;

  return (
    <div style={{
      margin: '4px 8px', padding: '8px',
      border: '1px solid var(--border-dark)',
      background: 'var(--terminal-bg)',
    }}>
      <div style={{
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-amber)', fontWeight: 'bold', marginBottom: '6px',
      }}>
        {'>'} CLAIM $NXT (On-Chain)
      </div>

      {claimEnabled === false && (
        <div style={{
          fontFamily: "'VT323', monospace", fontSize: '13px',
          color: 'var(--terminal-amber)', padding: '4px 0',
        }}>
          Claiming will be enabled soon.
        </div>
      )}

      {claimEnabled !== false && !hasClaimable && ids.length > 0 && (
        <div style={{
          fontFamily: "'VT323', monospace", fontSize: '13px',
          color: '#888', padding: '4px 0',
        }}>
          No $NXT to claim yet. Your devs earn 200 $NXT/day.
        </div>
      )}

      {claimEnabled !== false && ids.length === 0 && (
        <div style={{
          fontFamily: "'VT323', monospace", fontSize: '13px',
          color: '#888', padding: '4px 0',
        }}>
          No devs found. Mint a dev to start earning $NXT.
        </div>
      )}

      {hasClaimable && (
        <div style={{
          fontFamily: "'VT323', monospace", fontSize: '16px',
          color: 'var(--gold)', padding: '4px 0',
        }}>
          Claimable: {netDisplay} $NXT
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        <button
          className="win-btn"
          disabled={claimDisabled}
          onClick={handleClaim}
          style={{
            padding: '4px 16px',
            fontWeight: 'bold',
            fontSize: '11px',
            color: claimDisabled ? undefined : 'var(--win-text)',
          }}
        >
          {isSending ? 'SENDING...' : isMining ? 'MINING...' : `CLAIM ${hasClaimable ? netDisplay : '0'} $NXT`}
        </button>

        {/* TX status */}
        {txHash && !isConfirmed && (
          <span style={{ fontFamily: "'VT323', monospace", fontSize: '12px', color: 'var(--terminal-amber)' }}>
            TX pending...{' '}
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}
            >
              View
            </a>
          </span>
        )}

        {isConfirmed && (
          <span style={{ fontFamily: "'VT323', monospace", fontSize: '12px', color: 'var(--terminal-green)' }}>
            Successfully claimed {netDisplay} $NXT!{' '}
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}
            >
              View TX
            </a>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Balance Tab ───────────────────────────────────────────
function BalanceTab({ summary, loading, isConnected, wallet, tokenIds, history }) {
  if (loading) return <div className="loading">Loading wallet...</div>;
  if (!isConnected) return (
    <div style={{
      padding: '24px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: '28px' }}>$</div>
      <div>{'> Connect wallet to view your $NXT balance'}</div>
    </div>
  );
  if (!summary) return (
    <div style={{
      padding: '24px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-green)', background: 'var(--terminal-bg)',
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: '28px' }}>+</div>
      <div>{'> No devs yet. Mint your first developer to start earning $NXT!'}</div>
      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
        {'Each dev earns 200 $NXT/day. Open Mint/Hire Devs to get started.'}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* ── Section 1: Game Balance (Virtual) ── */}
      <div style={{
        padding: '4px 8px', margin: '4px 8px 0',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-amber)', fontWeight: 'bold',
      }}>
        {'>'} GAME BALANCE (Virtual)
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">Balance</div>
          <div className="stat-value" style={{ color: 'var(--gold-on-grey)' }}>
            {formatNumber(summary.balance_claimable)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value" style={{ color: 'var(--red-on-grey)' }}>
            {formatNumber(summary.total_spent || summary.balance_claimed || 0)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: 'var(--cyan-on-grey)' }}>
            {formatNumber(summary.balance_total_earned)}
          </div>
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

      {/* Virtual currency notice */}
      <div style={{
        padding: '4px 8px', margin: '2px 8px',
        fontFamily: "'VT323', monospace", fontSize: '11px',
        color: 'var(--text-muted, #888)',
      }}>
        Balance: available funds | Spent: protocols + AIs + investments | Earned: salaries + sells + returns
      </div>

      {/* Per-dev breakdown */}
      <div className="win-panel" style={{ overflow: 'auto', margin: '2px 4px', maxHeight: '140px' }}>
        <table className="win-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Rarity</th>
              <th>Balance</th>
              <th>Earned</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(summary.devs || []).map(dev => (
              <tr key={dev.token_id}>
                <td>#{dev.token_id}</td>
                <td style={{ fontWeight: 'bold' }}>{dev.name}</td>
                <td>
                  <span style={{ color: RARITY_COLORS[dev.rarity_tier] || '#c0c0c0' }}>
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

      {/* ── Balance Bar Chart ── */}
      <BalanceBarChart history={history} summary={summary} />

      {/* ── Section 2: Claim $NXT (On-Chain) ── */}
      <ClaimSection wallet={wallet} tokenIds={tokenIds} />
    </div>
  );
}

// ── Balance Bar Chart (for Balance tab) — Native SVG ─────
function BalanceBarChart({ history, summary }) {
  const data = (history || []).map(s => ({
    date: formatDate(s.snapshot_date),
    balance: Number(s.balance_claimable),
  }));

  // Need at least 1 data point
  if (data.length === 0 && summary) {
    data.push({ date: formatDate(new Date().toISOString().slice(0, 10)), balance: Number(summary.balance_claimable) || 0 });
  }
  if (data.length === 0) return null;

  const firstVal = data[0].balance;
  const lastVal = data[data.length - 1].balance;
  const trend = lastVal >= firstVal ? 'up' : 'down';
  const barColor = trend === 'up' ? '#00c853' : '#ef5350';

  const W = 600, H = 120;
  const PAD = { top: 8, right: 8, bottom: 18, left: 45 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const yValues = data.map(d => d.balance);
  const yMax = Math.max(...yValues) || 1;
  const yMin = 0;
  const yRange = yMax - yMin || 1;

  const barGap = 1;
  const barWidth = Math.max(2, (chartW / data.length) - barGap);

  const scaleY = (val) => PAD.top + chartH - ((val - yMin) / yRange) * chartH;
  const baselineY = PAD.top + chartH;

  // Grid lines (3 horizontal)
  const gridLines = [];
  for (let i = 0; i <= 3; i++) {
    const val = yMin + (yRange * i) / 3;
    gridLines.push({ y: scaleY(val), label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toLocaleString() });
  }

  const labelInterval = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ margin: '4px 8px', padding: '0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px',
        fontFamily: "'VT323', monospace", fontSize: '13px',
        background: 'var(--terminal-bg)',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>{'>'} Balance (30d)</span>
        <span style={{ color: barColor }}>
          {trend === 'up' ? '\u25B2' : '\u25BC'} {formatNumber(Math.abs(lastVal - firstVal))}
        </span>
      </div>
      <div className="protocol-chart" style={{ width: '100%', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} className="chart-grid-line" />
              <text x={PAD.left - 4} y={g.y + 3} fill="#555" fontSize="10" fontFamily="VT323, monospace" textAnchor="end">
                {g.label}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = PAD.left + (i / data.length) * chartW + barGap / 2;
            const barH = Math.max(1, ((d.balance - yMin) / yRange) * chartH);
            const opacity = 0.5 + 0.5 * (i / (data.length - 1 || 1));
            return (
              <rect key={i}
                x={x} y={baselineY - barH}
                width={barWidth} height={barH}
                fill={barColor} opacity={opacity}
                rx={1}
              />
            );
          })}

          {data.map((d, i) => (
            i % labelInterval === 0 ? (
              <text key={i}
                x={PAD.left + (i / data.length) * chartW + barWidth / 2}
                y={H - 2} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="middle"
              >
                {d.date}
              </text>
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

  // Filter to today's movements, reversed to chronological
  const todayMovements = movements
    .filter(m => new Date(m.timestamp).toDateString() === todayStr)
    .reverse();

  if (todayMovements.length === 0) return null;

  const data = todayMovements.map(m => ({
    label: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    amount: Number(m.amount) || 0,
    type: m.type,
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
        padding: '4px 8px',
        fontFamily: "'VT323', monospace", fontSize: '13px',
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
          {/* Center line (zero axis) */}
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke="#555" strokeWidth={0.5} />

          {/* Grid labels */}
          <text x={PAD.left - 4} y={PAD.top + 4} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            +{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>
          <text x={PAD.left - 4} y={midY + 3} fill="#666" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            0
          </text>
          <text x={PAD.left - 4} y={PAD.top + chartH + 2} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="end">
            -{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs}
          </text>

          {/* Bars */}
          {data.map((d, i) => {
            const x = PAD.left + (i / data.length) * chartW + barGap / 2;
            const isPositive = d.amount >= 0;
            const barH = Math.max(2, (Math.abs(d.amount) / maxAbs) * halfH);
            const y = isPositive ? midY - barH : midY;
            const fill = isPositive ? '#00c853' : '#ef5350';
            return (
              <rect key={i}
                x={x} y={y}
                width={barWidth} height={barH}
                fill={fill} opacity={0.75}
                rx={1}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((d, i) => (
            i % labelInterval === 0 ? (
              <text key={i}
                x={PAD.left + (i / data.length) * chartW + barWidth / 2}
                y={H - 2} fill="#555" fontSize="9" fontFamily="VT323, monospace" textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Movements Tab ─────────────────────────────────────────
function MovementsTab({ movements, history, summary, loading }) {
  if (loading) return <div className="loading">Loading movements...</div>;
  if (!movements || movements.length === 0) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%',
    }}>
      {'> No movements recorded yet.'}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MovementsChart movements={movements} summary={summary} />
      <div className="win-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <table className="win-table">
        <thead>
          <tr>
            <th style={{ width: '24px' }}></th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Dev</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m, i) => (
            <tr key={i}>
              <td style={{
                color: MOVEMENT_COLORS_GREY[m.type] || '#888',
                fontWeight: 'bold', textAlign: 'center', fontSize: '13px',
              }}>
                {MOVEMENT_ICONS[m.type] || '?'}
              </td>
              <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                {m.type}
              </td>
              <td style={{ fontSize: '10px', whiteSpace: 'normal' }}>
                {m.description}
              </td>
              <td style={{
                color: m.amount >= 0 ? 'var(--green-on-grey)' : 'var(--red-on-grey)',
                fontWeight: 'bold',
              }}>
                {m.amount >= 0 ? '+' : ''}{formatNumber(m.amount)} $NXT
              </td>
              <td style={{ fontSize: '10px' }}>
                {m.dev_name || (m.dev_id ? `#${m.dev_id}` : '-')}
              </td>
              <td style={{ fontSize: '10px' }}>
                {formatTimestamp(m.timestamp)}
              </td>
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
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);

  const { address, isConnected, displayAddress } = useWallet();
  const wallet = isConnected ? address : null;

  // On-chain read: tokensOfOwner (for fallback summary when API has no players record)
  const { data: tokenIds } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
  });

  // ── REST API data ────────────────────────────────────────
  useEffect(() => {
    if (!wallet) {
      setLoadingSummary(false);
      setLoadingHistory(false);
      setLoadingMovements(false);
      setSummary(null);
      setHistory([]);
      setMovements([]);
      return;
    }

    setLoadingSummary(true);
    setLoadingHistory(true);
    setLoadingMovements(true);

    api.getWalletSummary(wallet)
      .then(data => {
        setSummary(data);
        setLoadingSummary(false);
      })
      .catch((err) => {
        console.warn('[NxtWallet] wallet-summary failed:', err.message);
        // Fallback: build summary from on-chain tokenIds + individual dev API calls
        if (tokenIds && tokenIds.length > 0) {
          const ids = Array.from(tokenIds).map(id => Number(id));
          Promise.all(ids.map(id => api.getDev(id).catch(() => null)))
            .then(devs => {
              const valid = devs.filter(Boolean);
              if (valid.length > 0) {
                const totalBalance = valid.reduce((sum, d) => sum + (d.balance_nxt || 0), 0);
                const totalEarned = valid.reduce((sum, d) => sum + (d.total_earned || 0), 0);
                const totalSpent = valid.reduce((sum, d) => sum + (d.total_spent || 0), 0);
                setSummary({
                  wallet_address: wallet,
                  balance_claimable: totalBalance,
                  balance_claimed: totalSpent,
                  balance_total_earned: totalEarned,
                  total_devs: valid.length,
                  salary_per_day: valid.length * 200,
                  devs: valid.map(d => ({
                    token_id: d.token_id,
                    name: d.name,
                    rarity_tier: d.rarity_tier,
                    balance_nxt: d.balance_nxt || 0,
                    total_earned: d.total_earned || 0,
                    status: d.status || 'active',
                  })),
                  _fallback: true,
                });
              }
            })
            .catch(() => {})
            .finally(() => setLoadingSummary(false));
        } else {
          setLoadingSummary(false);
        }
      });

    api.getBalanceHistory(wallet)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));

    api.getMovements(wallet)
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false));
  }, [wallet, tokenIds]);

  const tabs = [
    { id: 'balance', label: 'Balance' },
    { id: 'movements', label: 'Movements' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div className="win-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`win-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'balance' && (
          <BalanceTab
            summary={summary}
            loading={loadingSummary}
            isConnected={isConnected}
            wallet={wallet}
            tokenIds={tokenIds}
            history={history}
          />
        )}
        {tab === 'movements' && <MovementsTab movements={movements} history={history} summary={summary} loading={loadingMovements} />}
      </div>

      {/* Status bar */}
      <div className="win98-statusbar" style={{ fontSize: '10px', color: '#555' }}>
        {wallet
          ? `${displayAddress} | Salary: 200 $NXT/day per dev`
          : 'Wallet not connected'
        }
      </div>
    </div>
  );
}
