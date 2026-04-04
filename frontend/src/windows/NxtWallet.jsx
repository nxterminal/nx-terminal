import { useState, useEffect, useRef, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, encodeFunctionData, decodeFunctionResult } from 'viem';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
import { useDevs } from '../contexts/DevsContext';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, NXT_TOKEN_ADDRESS, EXPLORER_BASE, MEGAETH_CHAIN_ID } from '../services/contract';

const MAINNET_RPC = 'https://mainnet.megaeth.com/rpc';

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

// ── Pay Stub Deductions ─────────────────────────────────
const DEDUCTIONS = [
  { label: 'Health Insurance (MegaETH)', pct: 3 },
  { label: 'Digital Life Insurance', pct: 2 },
  { label: 'Dev Union Fee', pct: 2.5 },
  { label: 'Anti-Hack Fund', pct: 1.5 },
  { label: 'Income Tax', pct: 1 },
];
const TOTAL_DEDUCTION_PCT = DEDUCTIONS.reduce((s, d) => s + d.pct, 0); // 10

// ── Direct mainnet RPC helpers ──────────────────────────
async function rpcCall(method, params) {
  const res = await fetch(MAINNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

async function fetchClaimEnabled() {
  try {
    const abi = NXDEVNFT_ABI.find(f => f.name === 'claimEnabled');
    const calldata = encodeFunctionData({ abi: [abi], functionName: 'claimEnabled' });
    const data = await rpcCall('eth_call', [{ to: NXDEVNFT_ADDRESS, data: calldata }, 'latest']);
    const decoded = decodeFunctionResult({ abi: [abi], functionName: 'claimEnabled', data });
    return Boolean(decoded);
  } catch { return true; }
}

async function fetchPreviewClaim(tokenIds) {
  const abi = NXDEVNFT_ABI.find(f => f.name === 'previewClaim');
  const calldata = encodeFunctionData({ abi: [abi], functionName: 'previewClaim', args: [tokenIds] });
  const data = await rpcCall('eth_call', [{ to: NXDEVNFT_ADDRESS, data: calldata }, 'latest']);
  const decoded = decodeFunctionResult({ abi: [abi], functionName: 'previewClaim', data });
  return { gross: BigInt(decoded[0]), fee: BigInt(decoded[1]), net: BigInt(decoded[2]) };
}

function AddTokenButton() {
  return (
    <button className="win-btn" onClick={() => {
      window.ethereum?.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address: NXT_TOKEN_ADDRESS, symbol: 'NXT', decimals: 18 } },
      });
    }} style={{ fontSize: '10px', padding: '2px 8px', fontFamily: "'VT323', monospace" }}>
      Add $NXT to MetaMask
    </button>
  );
}

// ── Withdraw Section (On-Chain) ──────────────────────────
function WithdrawSection({ wallet, tokenIds, gameBalance, devs, onClaimed }) {
  const allIds = tokenIds ? Array.from(tokenIds).map(id => BigInt(id)) : [];
  const { isConnected, chain } = useWallet();
  const isWrongChain = isConnected && chain?.id !== MEGAETH_CHAIN_ID;

  const [claimEnabled, setClaimEnabled] = useState(null);
  const [pendingOnChain, setPendingOnChain] = useState(null); // { gross, fee, net } from previewClaim
  const { data: txHash, writeContract, isPending: isSending, reset: resetTx } = useWriteContract();
  const { isLoading: isMining, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [claimStep, setClaimStep] = useState('idle'); // idle | syncing | signing | mining | success | error
  const [claimError, setClaimError] = useState(null);
  const [syncTxHash, setSyncTxHash] = useState(null);
  const [pct, setPct] = useState(100); // percentage selector

  // Check claimEnabled + pending on-chain balance on mount
  useEffect(() => {
    if (!wallet) return;
    fetchClaimEnabled().then(setClaimEnabled);
    if (allIds.length > 0) {
      fetchPreviewClaim(allIds).then(setPendingOnChain).catch(() => {});
    }
  }, [wallet, allIds.length]);

  useEffect(() => {
    if (isConfirmed) {
      setClaimStep('success');
      setPendingOnChain(null);
      // Record claim in backend for movements history
      api.recordClaim(wallet, {
        amount_gross: gross,
        amount_net: net,
        fee_amount: totalDeduction,
        tx_hash: txHash || '',
      }).catch(() => {}); // best-effort
      onClaimed?.();
    }
  }, [isConfirmed, onClaimed]);

  useEffect(() => { if (isSending) setClaimStep('signing'); }, [isSending]);
  useEffect(() => { if (isMining) setClaimStep('mining'); }, [isMining]);

  // Calculate based on percentage: claim is per-dev, so we select a subset of dev IDs
  // Sort devs by balance descending so partial claims take the richest devs first
  const sortedDevs = (devs || [])
    .filter(d => d.balance_nxt > 0)
    .sort((a, b) => b.balance_nxt - a.balance_nxt);

  // Determine how many devs to claim based on percentage
  const devCount = sortedDevs.length;
  const selectedDevCount = Math.max(1, Math.round(devCount * pct / 100));
  const selectedDevs = pct === 100 ? sortedDevs : sortedDevs.slice(0, selectedDevCount);
  const selectedIds = pct === 100
    ? allIds
    : selectedDevs.map(d => BigInt(d.token_id));

  // Calculate gross for selected devs
  const selectedGross = pct === 100
    ? (gameBalance || 0)
    : selectedDevs.reduce((s, d) => s + d.balance_nxt, 0);

  const gross = selectedGross;
  const net = Math.floor(gross * (1 - TOTAL_DEDUCTION_PCT / 100));
  const totalDeduction = gross - net;

  // ── Single COLLECT button: sync → claim via MetaMask ──
  const handleClaim = async () => {
    if (selectedIds.length === 0) return;
    setClaimStep('syncing');
    setClaimError(null);
    setSyncTxHash(null);
    resetTx();

    // Pass selected token IDs so backend only syncs these devs
    const idsToSync = selectedIds.map(id => Number(id));
    let syncResult;
    try {
      syncResult = await api.forceClaimSync(idsToSync);
    } catch (e) {
      setClaimStep('error');
      setClaimError('Sync failed: ' + (e.message || 'unknown error'));
      return;
    }

    if (syncResult.tx_hash) setSyncTxHash(syncResult.tx_hash);

    if (!syncResult.success) {
      setClaimStep('error');
      const detail = syncResult.result || 'unknown';
      if (syncResult.tx_hash) {
        setClaimError(`Sync TX reverted (${detail})`);
      } else if (detail === 'no_pending') {
        setClaimError('No balance to sync. Devs may still be earning.');
      } else {
        setClaimError(`Sync failed: ${detail}`);
      }
      return;
    }

    setClaimStep('signing');
    try {
      writeContract({
        address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI,
        functionName: 'claimNXT', args: [selectedIds],
      });
    } catch (e) {
      setClaimStep('error');
      setClaimError(e.code === 4001 ? 'Transaction rejected in MetaMask' : (e.message || 'unknown'));
    }
  };

  // Direct claim of pending on-chain balance (no sync needed)
  const handleClaimPending = () => {
    setClaimStep('signing');
    setClaimError(null);
    setSyncTxHash(null);
    resetTx();
    try {
      writeContract({
        address: NXDEVNFT_ADDRESS, abi: NXDEVNFT_ABI,
        functionName: 'claimNXT', args: [allIds],
      });
    } catch (e) {
      setClaimStep('error');
      setClaimError(e.code === 4001 ? 'Transaction rejected in MetaMask' : (e.message || 'unknown'));
    }
  };

  const handleRetry = () => { setClaimStep('idle'); setClaimError(null); setSyncTxHash(null); };

  const box = {
    margin: '4px 8px', padding: '10px',
    border: '1px solid var(--border-dark)', background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
  };
  const stubBorder = {
    padding: '10px 12px', border: '1px solid var(--border-dark)',
    background: 'rgba(0,0,0,0.15)', marginBottom: '8px',
  };
  const row = { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '13px' };
  const divider = { borderTop: '1px dashed var(--border-dark)', margin: '6px 0' };
  const pctBtn = (value) => ({
    padding: '3px 0', fontSize: '12px', fontWeight: pct === value ? 'bold' : 'normal',
    background: pct === value ? 'var(--gold-on-grey, #7a5c00)' : 'transparent',
    color: pct === value ? '#000' : '#999',
    border: `1px solid ${pct === value ? 'var(--gold-on-grey)' : 'var(--border-dark)'}`,
    cursor: 'pointer', flex: 1, textAlign: 'center',
    fontFamily: "'VT323', monospace",
  });

  return (
    <div style={box}>
      <div style={{ fontSize: '14px', color: 'var(--gold-on-grey, #7a5c00)', fontWeight: 'bold', marginBottom: '8px' }}>
        COLLECT YOUR PAY
      </div>

      {/* No devs */}
      {allIds.length === 0 && (
        <div style={{ ...stubBorder, fontSize: '12px', color: '#888' }}>
          No devs found. Mint a dev to start earning $NXT.
        </div>
      )}

      {/* No balance yet */}
      {allIds.length > 0 && !gameBalance && (
        <div style={{ ...stubBorder, fontSize: '12px', color: '#888' }}>
          Your devs haven&apos;t earned $NXT yet. They earn 200 $NXT/day through salary.
        </div>
      )}

      {/* ── Pending on-chain from previous sync ── */}
      {pendingOnChain && pendingOnChain.gross > BigInt(0) && claimStep === 'idle' && (
        <div style={{ ...stubBorder, borderColor: 'rgba(0,180,0,0.3)', background: 'rgba(0,80,0,0.08)' }}>
          <div style={{ fontSize: '12px', color: 'var(--terminal-amber)', marginBottom: '6px' }}>
            {'\u26A0'} You have <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>{formatNxt(pendingOnChain.net)} $NXT</span> pending on-chain
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
            From a previous sync. Collect it directly — no new sync needed.
          </div>
          <button className="win-btn" onClick={handleClaimPending}
            disabled={isWrongChain}
            style={{ padding: '4px 16px', fontSize: '12px', fontWeight: 'bold',
              background: '#2a5a00', color: '#fff', width: '100%', textAlign: 'center' }}>
            {'\uD83D\uDCB0'} Collect Pending {formatNxt(pendingOnChain.net)} $NXT
          </button>
        </div>
      )}

      {/* ── PAY STUB ── */}
      {allIds.length > 0 && gameBalance > 0 && claimEnabled !== false && (
        <div style={{ ...stubBorder, borderColor: 'rgba(122,92,0,0.3)' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)', marginBottom: '6px', letterSpacing: '1px' }}>
            PAY STUB
          </div>

          {/* Amount selector */}
          {claimStep === 'idle' && devCount > 1 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                Collect from ({selectedDevCount}/{devCount} devs):
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[25, 50, 75, 100].map(v => (
                  <button key={v} style={pctBtn(v)} onClick={() => setPct(v)}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gross salary */}
          <div style={row}>
            <span style={{ color: '#ccc' }}>Gross salary:</span>
            <span style={{ color: 'var(--gold-on-grey)' }}>{formatNumber(Math.round(gross))} $NXT</span>
          </div>

          <div style={divider} />

          {/* Deductions */}
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>Deductions:</div>
          {DEDUCTIONS.map(d => {
            const amt = Math.round(gross * d.pct / 100);
            return (
              <div key={d.label} style={{ ...row, fontSize: '12px' }}>
                <span style={{ color: '#999', paddingLeft: '8px' }}>{d.label}</span>
                <span style={{ color: 'var(--terminal-red, #ff4444)' }}>-{formatNumber(amt)} ({d.pct}%)</span>
              </div>
            );
          })}

          <div style={divider} />

          {/* Total deductions */}
          <div style={{ ...row, fontSize: '13px' }}>
            <span style={{ color: '#ccc' }}>Total deductions:</span>
            <span style={{ color: 'var(--terminal-red, #ff4444)' }}>-{formatNumber(Math.round(totalDeduction))} ({TOTAL_DEDUCTION_PCT}%)</span>
          </div>

          {/* Net pay */}
          <div style={{ ...row, fontSize: '14px', marginTop: '4px' }}>
            <span style={{ color: '#ccc', fontWeight: 'bold' }}>Net pay:</span>
            <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>
              ~{formatNumber(Math.round(net))} $NXT
            </span>
          </div>

          {/* Wrong chain warning */}
          {isWrongChain && (
            <div style={{ fontSize: '12px', color: 'var(--terminal-red)', margin: '8px 0 4px' }}>
              Switch to MegaETH network to collect.
            </div>
          )}

          {/* COLLECT button */}
          {claimStep === 'idle' && (
            <>
              <button className="win-btn" onClick={handleClaim}
                disabled={isWrongChain || selectedIds.length === 0}
                style={{ padding: '6px 20px', fontWeight: 'bold', fontSize: '13px', marginTop: '10px',
                  background: isWrongChain ? undefined : '#2a5a00', color: isWrongChain ? undefined : '#fff',
                  width: '100%', textAlign: 'center' }}>
                {'\uD83D\uDCB0'} COLLECT ~{formatNumber(Math.round(net))} $NXT
              </button>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                Devs keep earning salary after collection.
              </div>
            </>
          )}

          {claimStep === 'syncing' && (
            <div style={{ textAlign: 'center', padding: '8px', color: 'var(--terminal-amber)', fontSize: '13px', marginTop: '8px' }}>
              Syncing your earnings...
            </div>
          )}

          {claimStep === 'signing' && (
            <div style={{ textAlign: 'center', padding: '8px', color: 'var(--terminal-amber)', fontSize: '13px', marginTop: '8px' }}>
              Confirm in MetaMask...
            </div>
          )}

          {claimStep === 'mining' && (
            <div style={{ textAlign: 'center', padding: '8px', color: 'var(--terminal-amber)', fontSize: '13px', marginTop: '8px' }}>
              Processing...
              {txHash && (
                <span>{' '}<a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline', fontSize: '11px' }}>
                  TX: {txHash.slice(0, 10)}...
                </a></span>
              )}
            </div>
          )}

          {claimStep === 'success' && (
            <div style={{ textAlign: 'center', padding: '8px', marginTop: '8px' }}>
              <div style={{ color: 'var(--terminal-green)', fontSize: '13px', fontWeight: 'bold' }}>
                {'\u2705'} Collected! {txHash && <>TX: <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}>
                  {txHash.slice(0, 10)}...
                </a></>}
              </div>
              <button className="win-btn" onClick={() => {
                window.ethereum?.request({
                  method: 'wallet_watchAsset',
                  params: { type: 'ERC20', options: { address: NXT_TOKEN_ADDRESS, symbol: 'NXT', decimals: 18 } },
                });
              }} style={{ fontSize: '11px', padding: '3px 14px', marginTop: '8px' }}>
                Add $NXT to MetaMask
              </button>
            </div>
          )}

          {claimStep === 'error' && (
            <div style={{ textAlign: 'center', padding: '8px', marginTop: '8px' }}>
              <div style={{ color: 'var(--terminal-red, #ff4444)', fontSize: '12px', marginBottom: '6px' }}>
                {'\u274C'} {claimError}
              </div>
              {(syncTxHash || txHash) && (
                <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                  <a href={`${EXPLORER_BASE}/tx/${txHash || syncTxHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline' }}>
                    View TX on explorer
                  </a>
                </div>
              )}
              <button className="win-btn" onClick={handleRetry}
                style={{ fontSize: '11px', padding: '3px 14px', color: 'var(--terminal-red)' }}>
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Claiming disabled */}
      {claimEnabled === false && (
        <div style={{ ...stubBorder, borderColor: 'rgba(255,183,0,0.3)' }}>
          <div style={{ fontSize: '13px', color: 'var(--terminal-amber)' }}>Claiming will be enabled soon.</div>
        </div>
      )}
    </div>
  );
}

// ── Balance Tab ───────────────────────────────────────────
function BalanceTab({ summary, wallet, tokenIds, onClaimed }) {
  if (!summary) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Balance summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">In-Game</div>
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

      {/* Salary info + Add token */}
      <div style={{
        padding: '4px 8px', margin: '0 8px',
        fontFamily: "'VT323', monospace", fontSize: '14px',
        color: 'var(--terminal-green)', background: 'var(--terminal-bg)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          {'>'} Salary: <span style={{ color: 'var(--gold)' }}>200 $NXT/day</span> per dev
          {' \u00D7 '}{summary.total_devs} devs = <span style={{ color: 'var(--gold)' }}>{formatNumber(summary.salary_per_day)} $NXT/day</span>
        </span>
        <AddTokenButton />
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

      {/* Withdraw section */}
      <WithdrawSection wallet={wallet} tokenIds={tokenIds} gameBalance={summary.balance_claimable} devs={summary.devs} onClaimed={onClaimed} />
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
          <BalanceTab summary={summary} wallet={wallet} tokenIds={tokenIds} onClaimed={fetchAll} />
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
