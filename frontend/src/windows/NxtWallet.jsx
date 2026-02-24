import { useState, useEffect, useRef, useMemo } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, EXPLORER_BASE } from '../services/contract';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

const RARITY_COLORS = {
  common: 'var(--common-on-grey, #333333)', uncommon: 'var(--green-on-grey, #005500)', rare: 'var(--blue-on-grey, #0d47a1)',
  legendary: 'var(--gold-on-grey, #7a5c00)', mythic: 'var(--pink-on-grey, #660066)',
};

const MOVEMENT_ICONS = {
  salary: '+',
  sell: '+',
  spend: '-',
  shop: '-',
};

const MOVEMENT_COLORS = {
  salary: '#33ff33',
  sell: '#33ff33',
  spend: '#ff4444',
  shop: '#ff4444',
};

// Colors safe for grey (win-panel) backgrounds
const MOVEMENT_COLORS_GREY = {
  salary: 'var(--green-on-grey)',
  sell: 'var(--green-on-grey)',
  spend: 'var(--red-on-grey)',
  shop: 'var(--red-on-grey)',
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
            {formatNumber(summary.balance_claimed || 0)}
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

      {/* ── Mini Balance Chart ── */}
      <MiniBalanceChart history={history} />

      {/* ── Section 2: Claim $NXT (On-Chain) ── */}
      <ClaimSection wallet={wallet} tokenIds={tokenIds} />
    </div>
  );
}

// ── Mini Balance Chart (for Balance tab) ──────────────────
function MiniBalanceChart({ history }) {
  if (!history || history.length < 2) return null;

  const data = history.map(s => ({
    date: formatDate(s.snapshot_date),
    balance: Number(s.balance_claimable),
  }));

  const firstVal = data[0]?.balance || 0;
  const lastVal = data[data.length - 1]?.balance || 0;
  const trend = lastVal >= firstVal ? 'up' : 'down';
  const lineColor = trend === 'up' ? '#00c853' : '#ef5350';

  return (
    <div style={{ margin: '4px 8px', padding: '0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px',
        fontFamily: "'VT323', monospace", fontSize: '13px',
        background: 'var(--terminal-bg)',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>{'>'} Balance (30d)</span>
        <span style={{ color: lineColor }}>
          {trend === 'up' ? '\u25B2' : '\u25BC'} {formatNumber(Math.abs(lastVal - firstVal))}
        </span>
      </div>
      <div className="protocol-chart" style={{ height: '60px', padding: '0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="miniBalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="balance"
              stroke={lineColor} strokeWidth={1.5} fill="url(#miniBalGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Chart Tab (Candlestick) ───────────────────────────────
function ChartTab({ history, loading }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const candles = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map((s, i) => {
      const close = Number(s.balance_claimable);
      const open = i > 0 ? Number(history[i - 1].balance_claimable) : close;
      const earned = Number(s.balance_total_earned);
      const prevEarned = i > 0 ? Number(history[i - 1].balance_total_earned) : earned;
      const dailyActivity = Math.abs(earned - prevEarned);
      const delta = Math.abs(close - open);
      const base = Math.max(close, open, 1);
      const variance = Math.max(delta * 0.2, dailyActivity * 0.1, base * 0.005);
      const seed1 = ((i * 7 + 13) % 10) / 10;
      const seed2 = ((i * 11 + 3) % 10) / 10;
      return {
        date: formatDate(s.snapshot_date),
        open,
        close,
        high: Math.max(open, close) + variance * (0.3 + seed1 * 0.7),
        low: Math.min(open, close) - variance * (0.3 + seed2 * 0.7),
        volume: delta || dailyActivity * 0.1 || 1,
        isUp: close >= open,
      };
    });
  }, [history]);

  if (loading) return <div className="loading">Loading chart...</div>;
  if (!history || history.length === 0) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: '#0a0a14',
      height: '100%',
    }}>
      {'> No balance history yet. Snapshots are recorded daily.'}
    </div>
  );

  const { w, h } = dims;
  const firstVal = candles.length > 0 ? candles[0].open : 0;
  const lastVal = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const trend = lastVal >= firstVal ? 'up' : 'down';
  const changeAbs = Math.abs(lastVal - firstVal);
  const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100).toFixed(1) : '0.0';
  const trendColor = trend === 'up' ? '#00c853' : '#ef5350';
  const hovered = hoverIdx !== null && hoverIdx < candles.length ? candles[hoverIdx] : null;

  // Layout
  const pad = { top: 8, right: 52, bottom: 20, left: 8 };
  const chartW = Math.max(w - pad.left - pad.right, 1);
  const chartH = Math.max(h - pad.top - pad.bottom, 1);
  const volH = chartH * 0.15;
  const priceH = chartH - volH - 4;

  // Scales
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const priceMin = allPrices.length > 0 ? Math.min(...allPrices) * 0.98 : 0;
  const priceMax = allPrices.length > 0 ? Math.max(...allPrices) * 1.02 : 100;
  const priceRange = priceMax - priceMin || 1;
  const maxVol = Math.max(...candles.map(c => c.volume), 1);
  const gap = 2;
  const candleW = candles.length > 0 ? Math.max((chartW / candles.length) - gap, 2) : 4;
  const step = candles.length > 0 ? chartW / candles.length : chartW;
  const xPos = (i) => pad.left + i * step + step / 2;
  const yPrice = (v) => pad.top + priceH * (1 - (v - priceMin) / priceRange);
  const yVol = (v) => pad.top + priceH + 4 + volH * (1 - v / maxVol);
  const volBase = pad.top + priceH + 4 + volH;

  // Grid
  const gridCount = 5;
  const gridLines = [];
  for (let i = 1; i <= gridCount; i++) {
    const val = priceMin + (priceRange * i) / (gridCount + 1);
    gridLines.push({ y: yPrice(val), label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val) });
  }
  const labelInterval = Math.max(1, Math.ceil(candles.length / 7));

  const fmtPrice = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '10px',
        padding: '6px 12px', background: '#0d0d1a',
        borderBottom: '1px solid #1a1a2e',
        fontFamily: "'VT323', monospace", flexWrap: 'wrap',
      }}>
        <span style={{ color: '#666', fontSize: '13px' }}>$NXT</span>
        <span style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: 'bold' }}>
          {formatNumber(hovered ? Math.round(hovered.close) : lastVal)}
        </span>
        <span style={{ color: trendColor, fontSize: '14px' }}>
          {trend === 'up' ? '\u25B2' : '\u25BC'} {formatNumber(changeAbs)} ({changePct}%)
        </span>
        {hovered && (
          <span style={{ fontSize: '11px', color: '#555' }}>
            O:<span style={{ color: '#aaa' }}>{formatNumber(Math.round(hovered.open))}</span>{' '}
            H:<span style={{ color: '#aaa' }}>{formatNumber(Math.round(hovered.high))}</span>{' '}
            L:<span style={{ color: '#aaa' }}>{formatNumber(Math.round(hovered.low))}</span>{' '}
            C:<span style={{ color: hovered.isUp ? '#00c853' : '#ef5350' }}>{formatNumber(Math.round(hovered.close))}</span>
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: '#444', fontSize: '12px' }}>30D</span>
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, cursor: 'crosshair' }}>
        {w > 0 && h > 0 && candles.length > 0 && (
          <svg width={w} height={h} style={{ display: 'block' }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Grid */}
            {gridLines.map((g, i) => (
              <g key={`grid-${i}`}>
                <line x1={pad.left} y1={g.y} x2={w - pad.right} y2={g.y} stroke="#141428" />
                <text x={w - pad.right + 4} y={g.y + 3} fill="#444" fontSize="10" fontFamily="VT323, monospace">{g.label}</text>
              </g>
            ))}

            {/* Volume/price separator */}
            <line x1={pad.left} y1={pad.top + priceH + 2} x2={w - pad.right} y2={pad.top + priceH + 2} stroke="#1a1a2e" />

            {/* Reference line at open */}
            <line x1={pad.left} y1={yPrice(firstVal)} x2={w - pad.right} y2={yPrice(firstVal)} stroke="#252540" strokeDasharray="4 4" />

            {/* Volume bars */}
            {candles.map((c, i) => (
              <rect key={`vol-${i}`}
                x={xPos(i) - candleW / 2} y={yVol(c.volume)}
                width={candleW} height={Math.max(volBase - yVol(c.volume), 0)}
                fill={c.isUp ? '#00c853' : '#ef5350'} opacity={0.2}
              />
            ))}

            {/* Candlesticks */}
            {candles.map((c, i) => {
              const cx = xPos(i);
              const bodyTop = yPrice(Math.max(c.open, c.close));
              const bodyBot = yPrice(Math.min(c.open, c.close));
              const bodyH = Math.max(bodyBot - bodyTop, 1);
              const color = c.isUp ? '#00c853' : '#ef5350';
              return (
                <g key={`c-${i}`}>
                  {/* Wick */}
                  <line x1={cx} y1={yPrice(c.high)} x2={cx} y2={yPrice(c.low)} stroke={color} strokeWidth={1} />
                  {/* Body */}
                  <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                    fill={color} stroke={hoverIdx === i ? '#fff' : 'none'} strokeWidth={hoverIdx === i ? 0.5 : 0}
                  />
                  {/* Hover area */}
                  <rect x={xPos(i) - step / 2} y={pad.top} width={step} height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                </g>
              );
            })}

            {/* Hover crosshair */}
            {hoverIdx !== null && hoverIdx < candles.length && (
              <>
                <line x1={xPos(hoverIdx)} y1={pad.top} x2={xPos(hoverIdx)} y2={pad.top + chartH} stroke="#333" strokeDasharray="2 2" />
                <line x1={pad.left} y1={yPrice(candles[hoverIdx].close)} x2={w - pad.right} y2={yPrice(candles[hoverIdx].close)} stroke="#333" strokeDasharray="2 2" />
                {/* Price tag */}
                <rect x={w - pad.right + 1} y={yPrice(candles[hoverIdx].close) - 8} width={pad.right - 4} height={16}
                  fill={candles[hoverIdx].isUp ? '#00c853' : '#ef5350'} rx={2}
                />
                <text x={w - pad.right + 4} y={yPrice(candles[hoverIdx].close) + 4} fill="#fff" fontSize="10" fontFamily="VT323, monospace">
                  {fmtPrice(candles[hoverIdx].close)}
                </text>
              </>
            )}

            {/* X-axis labels */}
            {candles.map((c, i) => (
              i % labelInterval === 0 ? (
                <text key={`xl-${i}`} x={xPos(i)} y={h - 4} fill="#444" fontSize="10" fontFamily="VT323, monospace" textAnchor="middle">
                  {c.date}
                </text>
              ) : null
            ))}
          </svg>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 12px', background: '#0d0d1a',
        fontFamily: "'VT323', monospace", fontSize: '11px', color: '#555',
      }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span><span style={{ color: '#00c853' }}>{'\u2588'}</span> Bullish</span>
          <span><span style={{ color: '#ef5350' }}>{'\u2588'}</span> Bearish</span>
          <span style={{ opacity: 0.5 }}>{'\u25AE'} Vol</span>
        </div>
        <span>Daily snapshots</span>
      </div>
    </div>
  );
}

// ── Movements Chart (bar chart) ──────────────────────────
function MovementsChart({ movements }) {
  if (!movements || movements.length < 2) return null;

  // Group movements by day and sum income vs expense
  const byDay = {};
  movements.forEach(m => {
    const day = m.timestamp ? new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
    if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
    if (m.amount >= 0) byDay[day].income += m.amount;
    else byDay[day].expense += m.amount; // negative
  });
  const data = Object.values(byDay).reverse(); // oldest first
  if (data.length === 0) return null;

  return (
    <div style={{ height: '130px', padding: '4px 4px 0' }}>
      <div style={{
        fontFamily: "'VT323', monospace", fontSize: '13px',
        color: 'var(--terminal-green)', padding: '2px 8px',
        background: 'var(--terminal-bg)',
      }}>
        {'>'} Income / Expenses
      </div>
      <div className="protocol-chart" style={{ height: '100px', padding: '4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 8, bottom: 2, left: 8 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555' }} stroke="#222" tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#555' }} stroke="#222" tickLine={false} tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{
                background: '#1a1a2e', border: '1px solid #2a2a4e',
                fontFamily: "'VT323', monospace", fontSize: '13px', color: '#e0e0e0',
                borderRadius: '2px',
              }}
              formatter={(value, name) => [
                `${value >= 0 ? '+' : ''}${formatNumber(value)} $NXT`,
                name === 'income' ? 'Income' : 'Expenses',
              ]}
            />
            <ReferenceLine y={0} stroke="#333" />
            <Bar dataKey="income" fill="#00c853" opacity={0.85} stackId="stack" />
            <Bar dataKey="expense" fill="#ef5350" opacity={0.85} stackId="stack" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '10px', padding: '2px 0' }}>
        <span><span style={{ color: 'var(--green-on-grey)' }}>{'\u2588'}</span> Income</span>
        <span><span style={{ color: 'var(--red-on-grey)' }}>{'\u2588'}</span> Expenses</span>
      </div>
    </div>
  );
}

// ── Movements Tab ─────────────────────────────────────────
function MovementsTab({ movements, loading }) {
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
      <MovementsChart movements={movements} />
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
    { id: 'chart', label: 'Chart' },
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
        {tab === 'chart' && <ChartTab history={history} loading={loadingHistory} />}
        {tab === 'movements' && <MovementsTab movements={movements} loading={loadingMovements} />}
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
