import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, EXPLORER_BASE } from '../services/contract';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const RARITY_COLORS = {
  common: '#c0c0c0', uncommon: '#33ff33', rare: '#4488ff',
  legendary: '#ffd700', mythic: '#ff44ff',
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
function BalanceTab({ summary, loading, isConnected, wallet, tokenIds }) {
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
          <div className="stat-value" style={{ color: 'var(--gold)' }}>
            {formatNumber(summary.balance_claimable)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value" style={{ color: 'var(--terminal-red)' }}>
            {formatNumber(summary.balance_claimed || 0)}
          </div>
          <div className="stat-label">$NXT</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: 'var(--terminal-cyan)' }}>
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
        color: '#888',
      }}>
        Game balance is used for protocols, AIs, and investments.
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
                <td style={{ color: 'var(--gold)' }}>{formatNumber(dev.balance_nxt)}</td>
                <td>{formatNumber(dev.total_earned)}</td>
                <td>{dev.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 2: Claim $NXT (On-Chain) ── */}
      <ClaimSection wallet={wallet} tokenIds={tokenIds} />
    </div>
  );
}

// ── Chart Tab ─────────────────────────────────────────────
function ChartTab({ history, loading }) {
  if (loading) return <div className="loading">Loading chart...</div>;
  if (!history || history.length === 0) return (
    <div style={{
      padding: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '14px',
      color: 'var(--terminal-amber)', background: 'var(--terminal-bg)',
      height: '100%',
    }}>
      {'> No balance history yet. Snapshots are recorded daily.'}
    </div>
  );

  const data = history.map(s => ({
    date: formatDate(s.snapshot_date),
    balance: Number(s.balance_claimable),
    earned: Number(s.balance_total_earned),
  }));

  const firstVal = data[0]?.balance || 0;
  const lastVal = data[data.length - 1]?.balance || 0;
  const trend = lastVal >= firstVal ? 'up' : 'down';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px', padding: '4px 8px',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        background: 'var(--terminal-bg)',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>{'>'} Balance History (30 days)</span>
        <span style={{ color: trend === 'up' ? 'var(--terminal-green)' : 'var(--terminal-red)' }}>
          {trend === 'up' ? '\u25B2' : '\u25BC'} {formatNumber(Math.abs(lastVal - firstVal))} $NXT
        </span>
      </div>

      <div className="win-panel" style={{ flex: 1, padding: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date" tick={{ fontSize: 10, fill: '#888' }}
              stroke="#555"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#888' }}
              stroke="#555"
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a', border: '1px solid #555',
                fontFamily: "'VT323', monospace", fontSize: '13px',
                color: '#fff',
              }}
              formatter={(value, name) => [
                `${formatNumber(value)} $NXT`,
                name === 'balance' ? 'Balance' : 'Total Earned',
              ]}
            />
            <Line
              type="monotone" dataKey="balance" name="balance"
              stroke="#ffd700" strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: '#ffd700' }}
            />
            <Line
              type="monotone" dataKey="earned" name="earned"
              stroke="#33ff33" strokeWidth={1} dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 3, fill: '#33ff33' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px', fontSize: '10px' }}>
        <span><span style={{ color: '#ffd700' }}>{'\u2501\u2501'}</span> Balance</span>
        <span><span style={{ color: '#33ff33' }}>{'- -'}</span> Total Earned</span>
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
    <div className="win-panel" style={{ height: '100%', overflow: 'auto' }}>
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
                color: MOVEMENT_COLORS[m.type] || '#888',
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
                color: m.amount >= 0 ? 'var(--terminal-green)' : 'var(--terminal-red)',
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
