import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { formatUnits } from 'viem';
import { useWallet } from '../hooks/useWallet';
import { api } from '../services/api';
import { useDevs } from '../contexts/DevsContext';
import { NXT_TOKEN_ADDRESS } from '../services/contract';

const MAINNET_RPC = 'https://mainnet.megaeth.com/rpc';
const TREASURY_ADDRESS = '0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC';

const ARCHETYPE_COLORS = {
  '10X_DEV': 'var(--red-on-grey, #aa0000)', 'LURKER': 'var(--common-on-grey, #333333)', 'DEGEN': 'var(--gold-on-grey, #7a5c00)',
  'GRINDER': 'var(--blue-on-grey, #0d47a1)', 'INFLUENCER': 'var(--pink-on-grey, #660066)', 'HACKTIVIST': 'var(--green-on-grey, #005500)',
  'FED': 'var(--amber-on-grey, #7a5500)', 'SCRIPT_KIDDIE': 'var(--cyan-on-grey, #005060)',
};

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

const SHOP_ITEMS_MAP = {
  train_hacking: 'Intro to Hacking',
  train_coding: 'Optimization Workshop',
  train_trading: 'Advanced AI Trading',
};

const BOOT_LINES = [
  { text: 'NX TERMINAL — Developer Retrieval System v4.2', color: '#8B0000', delay: 0 },
  { text: 'Establishing secure connection to MegaETH...', color: '#333', delay: 300 },
  { text: 'Chain ID: 4326 .......................... OK', color: '#555', delay: 600 },
  { text: 'Scanning contract for owned tokens...', color: '#333', delay: 900 },
  { text: 'Decrypting personnel files...', color: '#333', delay: 1300 },
  { text: 'Compiling developer profiles...', color: '#333', delay: 1700 },
  { text: 'Loading dev workstations...', color: '#333', delay: 2100 },
];

function LoadingLore() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    // Asymptotic progress: fast at start, progressively slower, never stops
    const progTimer = setInterval(() => {
      setProgress(p => {
        if (p < 60) return p + 2;
        if (p < 85) return p + 1;
        if (p < 95) return p + 0.5;
        if (p < 99) return p + 0.2;
        return p; // stays at 99.x — component unmounts when loading finishes
      });
    }, 120);
    return () => { timers.forEach(clearTimeout); clearInterval(progTimer); };
  }, []);

  const barLen = 20;
  const displayPct = Math.floor(progress);
  const filled = Math.round((progress / 100) * barLen);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

  return (
    <div style={{
      padding: '16px 20px',
      fontFamily: "'VT323', monospace",
      fontSize: '13px',
      lineHeight: 1.6,
    }}>
      {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
        <div key={i} style={{ color: line.color }}>&gt; {line.text}</div>
      ))}
      <div style={{ marginTop: '8px', color: '#7a5c00' }}>
        [<span style={{ color: '#8B0000' }}>{bar}</span>] {displayPct}%
      </div>
    </div>
  );
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function StatBar({ label, value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / max) * 100));
  const color = pct > 66 ? 'var(--green-on-grey, #005500)' : pct > 33 ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
      <span style={{ width: '24px', color: 'var(--text-muted, #999)', textTransform: 'uppercase', fontWeight: 'bold' }}>{label}</span>
      <div style={{
        flex: 1, height: '6px', background: 'var(--terminal-bg, #111)',
        border: '1px solid var(--border-dark, #444)',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ width: '18px', textAlign: 'right', color, fontWeight: 'bold', fontSize: '9px' }}>{value || 0}</span>
    </div>
  );
}

function GifImage({ src, alt, arcColor, tokenId }) {
  const [status, setStatus] = useState(src ? 'loading' : 'none');

  return (
    <div style={{
      width: '80px', height: '80px', flexShrink: 0,
      background: 'var(--terminal-bg, #111)', border: '1px solid var(--border-dark, #333)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {src && status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated',
            opacity: status === 'loaded' ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
      {/* Skeleton / placeholder */}
      {(status === 'loading' || status === 'error' || status === 'none') && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted, #555)', fontSize: '10px',
          fontFamily: "'VT323', monospace",
          background: status === 'loading' ? undefined : 'var(--terminal-bg, #111)',
        }}>
          {status === 'loading' ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #666)', animation: 'pulse 1.5s infinite' }}>...</div>
          ) : (
            <>
              <div style={{ fontSize: '24px', color: arcColor }}>@</div>
              <div>#{tokenId}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuickPrompt({ devId, devName, address }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | 'error'

  const handleSend = (e) => {
    e.stopPropagation();
    if (!text.trim() || !address) return;
    setStatus('sending');
    api.postPrompt(devId, address, text.trim())
      .then(() => {
        setStatus('sent');
        setText('');
        setTimeout(() => setStatus(null), 3000);
      })
      .catch((err) => {
        if (err.message && err.message.includes('429')) {
          setStatus('busy');
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus('error');
        }
      });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex', gap: '3px', alignItems: 'center',
        marginTop: '3px', position: 'relative',
      }}
    >
      {status === 'sent' ? (
        <span style={{
          fontSize: '10px', color: 'var(--terminal-green, #33ff33)',
          fontFamily: "'VT323', monospace",
        }}>
          Order sent to {devName}!
        </span>
      ) : status === 'busy' ? (
        <span style={{
          fontSize: '10px', color: 'var(--terminal-amber, #ffaa00)',
          fontFamily: "'VT323', monospace",
        }}>
          {devName} is still processing the last order. Wait...
        </span>
      ) : (
        <>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
            placeholder={`Give orders to ${devName}...`}
            maxLength={500}
            disabled={status === 'sending'}
            style={{
              flex: 1, background: 'var(--terminal-bg, #111)', color: 'var(--terminal-green, #33ff33)',
              border: '1px solid var(--border-dark, #444)', padding: '2px 5px',
              fontFamily: "'VT323', monospace", fontSize: '11px', outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            className="win-btn"
            onClick={handleSend}
            disabled={!text.trim() || status === 'sending'}
            style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0, fontWeight: 'bold' }}
          >
            {status === 'sending' ? '..' : '>'}
          </button>
          {status === 'error' && (
            <span style={{ fontSize: '9px', color: 'var(--terminal-red, #ff4444)' }}>err</span>
          )}
        </>
      )}
    </div>
  );
}

// ── RPC helper for wallet balance ──────────────────────────
async function rpcCall(method, params) {
  const res = await fetch(MAINNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function fetchWalletNxtBalance(walletAddress) {
  const padded = walletAddress.slice(2).toLowerCase().padStart(64, '0');
  const data = await rpcCall('eth_call', [{ to: NXT_TOKEN_ADDRESS, data: '0x70a08231' + padded }, 'latest']);
  return BigInt(data);
}

async function waitForReceipt(txHash, maxWait = 60) {
  for (let i = 0; i < maxWait; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
      if (receipt) return receipt;
    } catch {}
  }
  throw new Error('Transaction not confirmed in time');
}

// ── Fund Modal ────────────────────────────────────────────
function FundModal({ dev, address, onClose, onDevUpdate }) {
  const [amount, setAmount] = useState('');
  const [walletBal, setWalletBal] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | signing | mining | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!address) return;
    fetchWalletNxtBalance(address)
      .then(wei => setWalletBal(Number(formatUnits(wei, 18))))
      .catch(() => setWalletBal(null));
  }, [address]);

  const amountNum = parseInt(amount, 10) || 0;
  const canFund = amountNum > 0 && walletBal !== null && amountNum <= walletBal && stage === 'idle';

  const doFund = async () => {
    if (!canFund) return;
    setStage('signing');
    setErrorMsg('');
    try {
      // Build ERC-20 transfer(address,uint256) calldata
      // selector: 0xa9059cbb
      const toAddr = TREASURY_ADDRESS.slice(2).toLowerCase().padStart(64, '0');
      const amountWei = BigInt(amountNum) * BigInt(10 ** 18);
      const amountHex = amountWei.toString(16).padStart(64, '0');
      const calldata = '0xa9059cbb' + toAddr + amountHex;

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address.toLowerCase(),
          to: NXT_TOKEN_ADDRESS,
          data: calldata,
        }],
      });

      setStage('mining');
      const receipt = await waitForReceipt(txHash);
      if (receipt.status !== '0x1') throw new Error('Transaction reverted');

      // Report to backend
      const res = await api.fundDev(address, dev.token_id, amountNum, txHash);
      setStage('success');
      if (res.updated_dev && onDevUpdate) onDevUpdate(res.updated_dev);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      setStage('error');
      const msg = err?.message || 'Unknown error';
      if (msg.includes('User denied') || msg.includes('rejected')) {
        setErrorMsg('Transaction rejected by user');
      } else {
        setErrorMsg(msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      }
    }
  };

  const presets = [25, 50, 100];

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 10010,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="win-raised" style={{
        width: '320px', background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: '13px',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Fund Dev</span>
          <button onClick={onClose} style={{
            background: '#c0c0c0', border: '1px outset #fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '11px',
            padding: '0 4px', lineHeight: 1,
          }}>X</button>
        </div>

        <div style={{ padding: '12px', fontSize: '13px' }}>
          <div style={{ color: '#333', marginBottom: '8px', fontStyle: 'italic' }}>
            "Every startup needs a seed round."
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Your wallet:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)' }}>
              {walletBal !== null ? `${Math.floor(walletBal)} $NXT` : '...'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>{dev.name} balance:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--gold-on-grey, #7a5c00)' }}>
              {formatNumber(dev.balance_nxt)} $NXT
            </span>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Amount:</label>
            <input
              type="number"
              min="1"
              max={walletBal ? Math.floor(walletBal) : 999999}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={stage !== 'idle'}
              style={{
                width: '100%', padding: '4px 6px', fontSize: '14px',
                fontFamily: "'VT323', monospace",
                background: '#fff', border: '2px inset #888',
              }}
              placeholder="0"
            />
          </div>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
            {presets.map(v => (
              <button key={v} className="win-btn" onClick={() => setAmount(String(v))}
                disabled={stage !== 'idle'}
                style={{ flex: 1, fontSize: '12px', padding: '2px' }}>{v}</button>
            ))}
            <button className="win-btn" onClick={() => setAmount(String(Math.floor(walletBal || 0)))}
              disabled={stage !== 'idle' || !walletBal}
              style={{ flex: 1, fontSize: '12px', padding: '2px' }}>ALL</button>
          </div>

          {/* Action button */}
          <button className="win-btn" onClick={doFund}
            disabled={!canFund}
            style={{
              width: '100%', padding: '6px', fontSize: '14px', fontWeight: 'bold',
              color: canFund ? '#005500' : '#888',
              border: canFund ? '2px outset #aaa' : undefined,
            }}>
            {stage === 'idle' && `\uD83D\uDCB0 FUND ${dev.name}`}
            {stage === 'signing' && 'Confirm in MetaMask...'}
            {stage === 'mining' && 'Processing...'}
            {stage === 'success' && '\u2705 Funded!'}
            {stage === 'error' && '\u274C Failed — Try Again'}
          </button>

          {stage === 'error' && errorMsg && (
            <div style={{ fontSize: '11px', color: '#aa0000', marginTop: '4px' }}>{errorMsg}</div>
          )}
          {stage === 'error' && (
            <button className="win-btn" onClick={() => setStage('idle')}
              style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}>
              Try Again
            </button>
          )}

          <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', textAlign: 'center' }}>
            Transfers $NXT from your MetaMask to your dev's in-game balance.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transfer Modal ────────────────────────────────────────
function TransferModal({ dev, allDevs, address, onClose, onDevUpdate }) {
  const [toDevId, setToDevId] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const otherDevs = (allDevs || []).filter(d => d.token_id !== dev.token_id && !d._fetchFailed);
  const selectedDev = otherDevs.find(d => d.token_id === Number(toDevId));
  const amountNum = parseInt(amount, 10) || 0;
  const canTransfer = amountNum > 0 && amountNum <= dev.balance_nxt && toDevId && stage === 'idle'
    && selectedDev && selectedDev.status !== 'on_mission' && dev.status !== 'on_mission';

  const doTransfer = async () => {
    if (!canTransfer) return;
    setStage('sending');
    setErrorMsg('');
    try {
      const res = await api.transferNxt(address, dev.token_id, Number(toDevId), amountNum);
      setStage('success');
      if (res.updated_from && onDevUpdate) onDevUpdate(res.updated_from);
      if (res.updated_to && onDevUpdate) onDevUpdate(res.updated_to);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      setStage('error');
      setErrorMsg(err?.message || 'Transfer failed');
    }
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 10010,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="win-raised" style={{
        width: '320px', background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: '13px',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Transfer Funds</span>
          <button onClick={onClose} style={{
            background: '#c0c0c0', border: '1px outset #fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '11px',
            padding: '0 4px', lineHeight: 1,
          }}>X</button>
        </div>

        <div style={{ padding: '12px', fontSize: '13px' }}>
          <div style={{ color: '#333', marginBottom: '8px', fontStyle: 'italic' }}>
            "Reallocating the budget. Standard corporate procedure."
          </div>

          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>From:</span>{' '}
            <span style={{ color: 'var(--gold-on-grey, #7a5c00)' }}>
              {dev.name} ({formatNumber(dev.balance_nxt)} $NXT)
            </span>
          </div>

          {/* Dev selector */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '2px' }}>To:</label>
            <select
              value={toDevId}
              onChange={e => setToDevId(e.target.value)}
              disabled={stage !== 'idle'}
              style={{
                width: '100%', padding: '4px', fontSize: '13px',
                fontFamily: "'VT323', monospace",
                background: '#fff', border: '2px inset #888',
              }}
            >
              <option value="">Select dev...</option>
              {otherDevs.map(d => {
                const onMission = d.status === 'on_mission';
                return (
                  <option key={d.token_id} value={d.token_id} disabled={onMission}>
                    {d.name} ({formatNumber(d.balance_nxt)} $NXT){d.balance_nxt === 0 ? ' \u2190 needs funds!' : ''}{onMission ? ' [ON MISSION]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '2px' }}>Amount:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="1"
                max={dev.balance_nxt}
                value={amount}
                onChange={e => setAmount(String(Math.min(Number(e.target.value) || 0, dev.balance_nxt)))}
                disabled={stage !== 'idle'}
                style={{
                  width: '100px', padding: '6px 10px', fontSize: '18px',
                  fontFamily: "'VT323', monospace",
                  background: '#1a1a2e', color: '#66ff66',
                  border: '2px solid #3a5a3a', textAlign: 'center',
                  outline: 'none',
                }}
                placeholder="0"
              />
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: '#888' }}>
                / {formatNumber(dev.balance_nxt)} $NXT
              </span>
            </div>
          </div>

          {/* Action button */}
          <button className="win-btn" onClick={doTransfer}
            disabled={!canTransfer}
            style={{
              width: '100%', padding: '6px', fontSize: '14px', fontWeight: 'bold',
              color: canTransfer ? '#005500' : '#888',
              border: canTransfer ? '2px outset #aaa' : undefined,
            }}>
            {stage === 'idle' && '\uD83D\uDCBC TRANSFER'}
            {stage === 'sending' && 'Processing...'}
            {stage === 'success' && '\u2705 Transferred!'}
            {stage === 'error' && '\u274C Failed'}
          </button>

          {stage === 'error' && errorMsg && (
            <div style={{ fontSize: '11px', color: '#aa0000', marginTop: '4px' }}>{errorMsg}</div>
          )}
          {stage === 'error' && (
            <button className="win-btn" onClick={() => setStage('idle')}
              style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}>
              Try Again
            </button>
          )}

          <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', textAlign: 'center' }}>
            Moves $NXT between your devs. No blockchain transaction needed.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Stat Icons (16x16 viewBox) ──────────────────────
function StatIcon({ type, size = 14 }) {
  const s = { display: 'block' };
  switch (type) {
    case 'energy': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="currentColor"/></svg>;
    case 'pc': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M5 13h6M8 11v2" stroke="currentColor" strokeWidth="1.5"/></svg>;
    case 'knowledge': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><path d="M3 2v11l5-2 5 2V2H3z" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M8 3v8" stroke="currentColor" strokeWidth="1"/></svg>;
    case 'bugs': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><ellipse cx="8" cy="9" rx="4" ry="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M2 7h3M11 7h3M2 11h3M11 11h3M5.5 2l1 3.5M10.5 2l-1 3.5" stroke="currentColor" strokeWidth="1.2"/></svg>;
    case 'social': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><circle cx="6" cy="5" r="2" fill="currentColor"/><path d="M2 14c0-2.5 2-4.5 4-4.5s4 2 4 4.5" fill="currentColor"/><circle cx="11" cy="5.5" r="1.5" fill="currentColor" opacity="0.7"/><path d="M9 14c0-2 1.2-3.5 2-3.5s2 1.5 2 3.5" fill="currentColor" opacity="0.7"/></svg>;
    case 'caffeine': return <svg style={s} width={size} height={size} viewBox="0 0 16 16"><path d="M3 5h8v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M11 6h1.5a1.5 1.5 0 010 3H11" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M5 2c.5 1 0 2 .5 2.5M7.5 2c.5 1 0 2 .5 2.5" stroke="currentColor" strokeWidth="1" opacity="0.5"/></svg>;
    default: return null;
  }
}

// ── Bar color thresholds ────────────────────────────────
function barColor(pct, inverse) {
  if (inverse) {
    if (pct <= 20) return '#44ff44';
    if (pct <= 50) return '#ffaa00';
    if (pct <= 75) return '#ff4444';
    return '#cc0000';
  }
  if (pct >= 70) return '#44ff44';
  if (pct >= 40) return '#ffaa00';
  if (pct >= 15) return '#ff4444';
  return '#cc0000';
}

// ── Vital Bar (compact, VT323) ──────────────────────────
function VitalBar({ iconType, label, value, max = 100, inverse = false }) {
  const v = value ?? 0;
  const m = max || 100;
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const color = barColor(pct, inverse);
  const critical = (!inverse && pct < 15) || (inverse && pct > 75);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '14px', color: '#111',
          fontFamily: "'VT323', monospace",
        }}>
          <span style={{
            width: '18px', height: '18px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${color}`, background: 'rgba(0,0,0,0.15)',
            flexShrink: 0, color, transition: 'border-color 0.5s, color 0.5s',
          }}>
            <StatIcon type={iconType} size={10} />
          </span>
          {label}
        </span>
        <span style={{
          fontSize: '14px', color,
          fontFamily: "'VT323', monospace",
          transition: 'color 0.5s',
        }}>{v}</span>
      </div>
      <div style={{
        height: '10px', background: '#333',
        borderRadius: '2px', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: '2px',
          transition: 'width 0.5s ease, background-color 0.5s ease',
          animation: critical ? 'critical-pulse 1.5s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  );
}

// ── Stone Button (pixel art 3D, VT323) ──────────────────
function StoneBtn({ emoji, label, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
        width: '100%',
        padding: '7px 2px',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        textTransform: 'uppercase',
        color: disabled ? '#555' : '#1a2030',
        background: disabled ? '#4a4a4a' : '#6b7b8a',
        border: 'none',
        borderRadius: '2px',
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled
          ? 'inset -2px -2px 0 #333, inset 2px 2px 0 #666'
          : 'inset -3px -3px 0 #3a4654, inset 3px 3px 0 #8fa0b0, 0 3px 0 #2a3444, 0 4px 0 #1a2434',
        transition: 'transform 0.05s',
      }}
    >
      {emoji && <span style={{ fontSize: '13px' }}>{emoji}</span>}
      {label}
    </button>
  );
}

// ── Econ Dropdown (FUND + SEND) ─────────────────────────
function EconDropdown({ dev, allDevs, busy, onFund, onTransfer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <StoneBtn emoji={'\uD83D\uDCB0'} label="ECONOMY"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        title="Fund or transfer $NXT" />
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 20, background: '#6b7b8a', borderRadius: '2px', overflow: 'hidden',
          boxShadow: 'inset -2px -2px 0 #3a4654, inset 2px 2px 0 #8fa0b0, 0 3px 0 #2a3444',
        }}>
          <button onClick={(e) => { onFund(e); setOpen(false); }} style={{
            display: 'block', width: '100%', padding: '6px 8px', border: 'none',
            background: 'transparent', color: '#1a2030', cursor: 'pointer',
            fontFamily: "'VT323', monospace", fontSize: '14px',
            textAlign: 'left',
          }}>{'\uD83D\uDCB0'} FUND</button>
          {allDevs && allDevs.length > 1 && (
            <button onClick={(e) => { onTransfer(e); setOpen(false); }}
              disabled={dev.balance_nxt <= 0}
              style={{
                display: 'block', width: '100%', padding: '6px 8px', border: 'none',
                borderTop: '2px solid #3a4654',
                background: 'transparent',
                color: dev.balance_nxt <= 0 ? '#555' : '#1a2030',
                cursor: dev.balance_nxt <= 0 ? 'default' : 'pointer',
                fontFamily: "'VT323', monospace", fontSize: '14px',
                textAlign: 'left',
              }}>{'\uD83D\uDD04'} TRANSFER</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hack Dropdown (MAINFRAME + PLAYER) ─────────────────
function HackDropdown({ dev, busy, onHackMainframe, onHackPlayer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <StoneBtn emoji={'🔓'} label={'HACK ▾'}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        title="Hack: choose Mainframe (15 $NXT, safe) or Player (25 $NXT, risky)" />
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 20, background: '#6b7b8a', borderRadius: '2px', overflow: 'hidden',
          boxShadow: 'inset -2px -2px 0 #3a4654, inset 2px 2px 0 #8fa0b0, 0 3px 0 #2a3444',
        }}>
          <button onClick={(e) => { onHackMainframe(e); setOpen(false); }} style={{
            display: 'block', width: '100%', padding: '6px 8px', border: 'none',
            background: 'transparent', color: '#1a2030', cursor: 'pointer',
            fontFamily: "'VT323', monospace", fontSize: '14px',
            textAlign: 'left',
          }}>{'\uD83D\uDDA5\uFE0F'} MAINFRAME — 15 $NXT</button>
          <button onClick={(e) => { onHackPlayer(e); setOpen(false); }} style={{
            display: 'block', width: '100%', padding: '6px 8px', border: 'none',
            borderTop: '2px solid #3a4654',
            background: 'transparent', color: '#1a2030', cursor: 'pointer',
            fontFamily: "'VT323', monospace", fontSize: '14px',
            textAlign: 'left',
          }}>{'\uD83D\uDC64'} PLAYER — 25 $NXT</button>
        </div>
      )}
    </div>
  );
}

// ── Hack Result Modal ──────────────────────────────────
function HackResultModal({ result, onClose }) {
  if (!result) return null;
  const ok = result.hack_success;
  const isPlayer = result.hack_type === 'player';
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', border: `2px solid ${ok ? '#3a5a3a' : '#5a3a3a'}`,
        minWidth: 300, maxWidth: 400, fontFamily: "'VT323', monospace",
        boxShadow: `inset -3px -3px 0 #0a0a1e, inset 3px 3px 0 #2a2a4e, 0 0 30px ${ok ? 'rgba(0,255,100,0.1)' : 'rgba(255,0,0,0.1)'}`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: '#0a0a1e',
          borderBottom: `2px solid ${ok ? '#44ffaa' : '#ff4444'}`,
        }}>
          <span style={{ fontSize: 18, letterSpacing: 2, color: ok ? '#44ffaa' : '#ff4444' }}>
            {ok ? '> ACCESS GRANTED' : '> ACCESS DENIED'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', color: '#aaa',
            fontFamily: "'VT323', monospace", fontSize: 16, cursor: 'pointer', padding: '2px 8px',
          }}>X</button>
        </div>
        {/* Body */}
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#888', letterSpacing: 1, marginBottom: 8 }}>
            {isPlayer ? '\uD83D\uDC64 PLAYER HACK' : '\uD83D\uDDA5\uFE0F MAINFRAME HACK'}
          </div>
          <div style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>
            TARGET: {result.target_name}
            {result.target_corp && ` [${result.target_corp}]`}
            {result.target_owner && (
              <span style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 2 }}>
                {result.target_owner}
              </span>
            )}
          </div>
          <div style={{
            color: ok ? '#44ffaa' : '#ff4444', fontSize: 24,
            fontWeight: 'bold', letterSpacing: 2, marginBottom: 16,
          }}>
            {ok ? `+${result.stolen} $NXT` : `-${result.cost} $NXT`}
          </div>
          <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.8, marginBottom: 12 }}>
            <div style={{ color: '#ff6666' }}>Cost: -{result.cost} $NXT</div>
            {ok && (
              <>
                <div style={{ color: '#44ffaa' }}>Extracted: +{result.stolen} $NXT</div>
                <div style={{ color: '#44ccff' }}>Social: +{isPlayer ? 8 : 5}</div>
              </>
            )}
            <div style={{
              color: result.net_gain >= 0 ? '#ffdd44' : '#ff4444',
              fontWeight: 'bold', marginTop: 8, fontSize: 16,
            }}>
              NET: {result.net_gain >= 0 ? '+' : ''}{result.net_gain} $NXT
            </div>
          </div>
          <div style={{
            fontSize: 12, color: '#666', fontStyle: 'italic',
            borderTop: '1px solid #333', paddingTop: 10,
          }}>
            {result.message}
          </div>
          {!ok && isPlayer && (
            <div style={{ color: '#ff9800', fontSize: 12, marginTop: 8 }}>
              {'\u26A0'} Your {result.cost} $NXT was seized by {result.target_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hack Error Modal (all error types) ─────────────────
const HACK_ERROR_CONFIG = {
  cooldown:           { icon: '🔒', title: '> SYSTEM LOCKDOWN',    color: '#ff9800' },
  insufficient_funds: { icon: '💰', title: '> INSUFFICIENT FUNDS', color: '#ff4444' },
  low_social:         { icon: '👤', title: '> LOW REPUTATION',     color: '#ff6644' },
  no_targets:         { icon: '🔍', title: '> NO TARGETS',         color: '#888888' },
};
const HACK_ERROR_DEFAULT = { icon: '❌', title: '> HACK ERROR', color: '#ff4444' };

function HackErrorModal({ error, onClose }) {
  if (!error) return null;
  const c = HACK_ERROR_CONFIG[error.error] || HACK_ERROR_DEFAULT;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', border: `2px solid ${c.color}33`,
        minWidth: 300, maxWidth: 400, fontFamily: "'VT323', monospace",
        boxShadow: `inset -3px -3px 0 #0a0a1e, inset 3px 3px 0 #2a2a4e, 0 0 30px ${c.color}1a`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: '#0a0a1e',
          borderBottom: `2px solid ${c.color}`,
        }}>
          <span style={{ fontSize: 18, letterSpacing: 2, color: c.color }}>
            {c.title}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', color: '#aaa',
            fontFamily: "'VT323', monospace", fontSize: 16, cursor: 'pointer', padding: '2px 8px',
          }}>X</button>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
          <div style={{ color: c.color, fontSize: 15, marginBottom: 16 }}>
            {error.message}
          </div>
          {error.error === 'cooldown' && (
            <div style={{ color: '#ffdd44', fontSize: 22, marginBottom: 8 }}>
              {error.remaining_hours}h {error.remaining_minutes}m
            </div>
          )}
          {error.error === 'insufficient_funds' && (
            <div style={{ color: '#aaa', fontSize: 13 }}>
              Required: {error.required} $NXT | Available: {error.current} $NXT
            </div>
          )}
          {error.error === 'low_social' && (
            <div style={{ color: '#aaa', fontSize: 13 }}>
              Required: {error.required} Social | Current: {error.current}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Spend Animation + Sound ─────────────────────────────
// ── Sound Effects ───────────────────────────────────────
function playSpendSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function playGainSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function playActionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.setValueAtTime(700, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

// ── Animation Color Map ────────────────────────────────
const ANIM_COLORS = {
  '$NXT_spend': '#ff4444', '$NXT_gain': '#ffdd44',
  'energy_spend': '#ff9800', 'energy_gain': '#66ff66',
  'bugs_gain': '#44ffcc', 'caffeine_gain': '#66ff66',
  'social_gain': '#66ff66', 'knowledge_gain': '#44ccff',
  'pc_gain': '#66ff66', 'reputation_gain': '#ffdd44',
};

function getAnimColor(stat, type) {
  return ANIM_COLORS[`${stat}_${type}`] || (type === 'spend' ? '#ff4444' : '#66ff66');
}

const STAT_NAMES = {
  '$NXT': '$NXT', energy: 'Energy', bugs: 'Bugs', caffeine: 'Caffeine',
  social: 'Social', knowledge: 'Knowledge', pc: 'PC Health', reputation: 'Rep',
  mood: 'Mood',
};

// ── Multi-stat Animation Overlay ───────────────────────
function SpendOverlay({ spends }) {
  if (!spends.length) return null;
  return (
    <div style={{
      position: 'absolute', top: '20%', left: 0, right: 0,
      pointerEvents: 'none', zIndex: 100, display: 'flex',
      flexDirection: 'column', alignItems: 'center',
    }}>
      {spends.map(s => (
        <div key={s.id} style={{
          fontFamily: "'VT323', monospace", fontSize: '16px', fontWeight: 'bold',
          color: getAnimColor(s.stat || (s.type === 'energy' ? 'energy' : '$NXT'), s.animType || 'spend'),
          whiteSpace: 'nowrap',
          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          animation: `float-up-fade 1.5s ease-out ${s.delay || 0}ms forwards`,
          opacity: 0,
        }}>
          {s.amount > 0 ? '+' : ''}{s.amount} {STAT_NAMES[s.stat] || s.stat || (s.type === 'energy' ? 'Energy' : '$NXT')}
        </div>
      ))}
    </div>
  );
}

function DevCard({ dev, onClick, address, onRetry, onDevUpdate, mission, allDevs, onHackResult, onHackError }) {
  const arcColor = ARCHETYPE_COLORS[dev.archetype] || '#ccc';
  const gifUrl = dev.ipfs_hash ? `${IPFS_GW}${dev.ipfs_hash}` : null;
  const energyPct = dev.max_energy ? Math.round((dev.energy / dev.max_energy) * 100) : (dev.energy || 0);
  const energyHigh = energyPct >= 70;
  const onMission = dev.status === 'on_mission';
  const missionCompleted = onMission && mission && new Date(mission.ends_at) <= new Date();
  const loc = dev.location ? dev.location.replace(/_/g, ' ') : null;
  const [actionMsg, setActionMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [spends, setSpends] = useState([]);

  const triggerChanges = useCallback((changes) => {
    if (!changes || !changes.length) return;
    const newAnims = changes.map((c, i) => ({
      id: Date.now() + i,
      stat: c.stat,
      amount: c.amount,
      animType: c.type,
      delay: i * 200,
    }));
    setSpends(prev => [...prev, ...newAnims]);
    const hasSpend = changes.some(c => c.type === 'spend');
    const hasGain = changes.some(c => c.type === 'gain');
    if (hasSpend) playSpendSound();
    else if (hasGain) playGainSound();
    else playActionSound();
    const ids = newAnims.map(a => a.id);
    setTimeout(() => setSpends(prev => prev.filter(s => !ids.includes(s.id))), 2000);
  }, []);

  // Legacy compatibility wrapper
  const triggerSpend = useCallback((amount, type = 'nxt') => {
    triggerChanges([{ stat: type === 'energy' ? 'energy' : '$NXT', amount: -Math.abs(amount), type: 'spend' }]);
  }, [triggerChanges]);

  const lockBusy = () => { if (busyRef.current) return false; busyRef.current = true; setBusy(true); return true; };
  const unlockBusy = (cooldownMs = 1000) => {
    setTimeout(() => { busyRef.current = false; setBusy(false); }, cooldownMs);
  };

  const parseError = (err) => {
    const msg = err?.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch'))
      return { text: 'Network error — check connection', color: '#aa0000' };
    if (msg.includes('Rate limited') || msg.includes('429')) return { text: 'Too fast! Wait a moment', color: '#b8860b' };
    if (msg.includes('Not enough')) return { text: msg, color: '#aa0000' };
    if (msg.includes('cooldown') || msg.includes('Cooldown')) return { text: msg, color: '#b8860b' };
    if (msg) return { text: msg, color: '#aa0000' };
    return { text: 'Action failed', color: '#aa0000' };
  };

  // Vital stats — real values from backend
  const pcHealth = dev.pc_health ?? 100;
  const bugsVal = dev.bugs_shipped ?? 0;
  const bugsMax = 20;
  const knowledge = dev.knowledge ?? 50;
  const social = dev.social_vitality ?? (dev.stat_social || 50);
  const caffeine = dev.caffeine ?? 50;

  const doShopAction = async (e, itemId, label) => {
    e.stopPropagation();
    if (!address || !lockBusy()) return;
    try {
      const res = await api.buyItem(address, itemId, dev.token_id);
      setActionMsg({ text: `${label} applied!`, color: '#005500' });
      if (res.changes && res.changes.length) triggerChanges(res.changes);
      else if (res.cost) triggerSpend(res.cost);
      if (res.updated_dev && onDevUpdate) {
        onDevUpdate(res.updated_dev);
      } else {
        const fresh = await api.getDev(dev.token_id, address).catch(() => null);
        if (fresh && onDevUpdate) onDevUpdate(fresh);
      }
    } catch (err) {
      setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 2500);
  };

  const doHackMainframe = async (e) => {
    e.stopPropagation();
    if (!address || !lockBusy()) return;
    try {
      const res = await api.hackMainframe(address, dev.token_id);
      if (res.changes && res.changes.length) triggerChanges(res.changes);
      else triggerSpend(15);
      if (onHackResult) onHackResult(res);
      const fresh = await api.getDev(dev.token_id, address).catch(() => null);
      if (fresh && onDevUpdate) onDevUpdate(fresh);
    } catch (err) {
      if (err.detail && onHackError) onHackError(err.detail);
      else setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 4000);
  };

  const doHackPlayer = async (e) => {
    e.stopPropagation();
    if (!address || !lockBusy()) return;
    try {
      const res = await api.hackPlayer(address, dev.token_id);
      if (res.changes && res.changes.length) triggerChanges(res.changes);
      else triggerSpend(25);
      if (onHackResult) onHackResult(res);
      const fresh = await api.getDev(dev.token_id, address).catch(() => null);
      if (fresh && onDevUpdate) onDevUpdate(fresh);
    } catch (err) {
      if (err.detail && onHackError) onHackError(err.detail);
      else setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 4000);
  };

  const doGraduate = async (e) => {
    e.stopPropagation();
    if (!address || !lockBusy()) return;
    try {
      const res = await api.graduate(address, dev.token_id);
      setActionMsg({ text: `Graduated! ${res.stat} +${res.bonus}`, color: '#005500' });
      if (res.changes && res.changes.length) triggerChanges(res.changes);
      const fresh = await api.getDev(dev.token_id, address).catch(() => null);
      if (fresh && onDevUpdate) onDevUpdate(fresh);
    } catch (err) {
      setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 3000);
  };

  const doFixBug = async (e) => {
    e.stopPropagation();
    if (!address || !lockBusy()) return;
    try {
      const res = await api.buyItem(address, 'fix_bugs', dev.token_id);
      if (res.changes && res.changes.length) triggerChanges(res.changes);
      else if (res.energy_cost) triggerSpend(res.energy_cost, 'energy');
      setActionMsg({ text: 'Bugs fixed!', color: '#005500' });
      if (res.updated_dev && onDevUpdate) {
        onDevUpdate(res.updated_dev);
      } else {
        const fresh = await api.getDev(dev.token_id, address).catch(() => null);
        if (fresh && onDevUpdate) onDevUpdate(fresh);
      }
    } catch (err) {
      setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 3000);
  };

  const doClaimMission = async (e) => {
    e.stopPropagation();
    if (!mission || !lockBusy()) return;
    try {
      await api.claimMission(address, mission.player_mission_id);
      setActionMsg({ text: `+${mission.reward_nxt} $NXT \u2192 ${dev.name}'s balance! Collect in NXT Wallet`, color: '#005500' });
      const fresh = await api.getDev(dev.token_id, address);
      if (fresh && onDevUpdate) onDevUpdate(fresh);
    } catch (err) {
      setActionMsg(parseError(err));
    }
    unlockBusy();
    setTimeout(() => setActionMsg(null), 5000);
  };

  return (
    <div
      className="win-raised"
      onClick={onClick}
      style={{
        padding: '8px', cursor: 'pointer', marginBottom: '4px',
        border: '1px solid var(--border-dark)',
        position: 'relative', overflow: 'visible',
        filter: onMission && !missionCompleted ? 'grayscale(100%)' : 'none',
        opacity: onMission && !missionCompleted ? 0.7 : 1,
      }}
    >
      <SpendOverlay spends={spends} />

      {/* Row 1: Avatar + Identity */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
        <GifImage src={gifUrl} alt={dev.name} arcColor={arcColor} tokenId={dev.token_id} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' }}>
          {dev._fetchFailed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '2px 6px', marginBottom: '2px',
              background: 'var(--terminal-bg, #111)', border: '1px solid var(--terminal-amber, #ffaa00)',
              fontSize: '12px', fontFamily: "'VT323', monospace", color: 'var(--terminal-amber, #ffaa00)',
            }}>
              [!] Profile loading from chain...
              <button className="win-btn"
                onClick={(e) => { e.stopPropagation(); onRetry?.(dev.token_id); }}
                style={{ fontSize: '11px', padding: '0 4px', marginLeft: 'auto' }}>Retry</button>
            </div>
          )}
          {/* Name + Archetype + Rarity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontFamily: "'VT323', monospace" }}>{dev.name}</span>
            <span style={{ color: arcColor, fontSize: '13px', fontFamily: "'VT323', monospace" }}>[{dev.archetype}]</span>
            {dev.rarity_tier && dev.rarity_tier !== 'common' && (
              <span style={{
                fontSize: '10px', padding: '0 3px', textTransform: 'uppercase',
                color: 'var(--gold-on-grey, #7a5c00)',
                border: '1px solid var(--gold-on-grey, #7a5c00)', borderRadius: '2px',
                fontFamily: "'VT323', monospace",
              }}>{dev.rarity_tier}</span>
            )}
          </div>
          {/* Corp | Species | Location | #Token */}
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', display: 'flex', gap: '6px', flexWrap: 'wrap', fontFamily: "'VT323', monospace", lineHeight: 1.3 }}>
            {dev.corporation && <span>{dev.corporation.replace(/_/g, ' ')}</span>}
            {dev.species && <span>| {dev.species}</span>}
            {loc && <span>| {loc}</span>}
            <span>| #{dev.token_id}</span>
          </div>
          {/* Status line */}
          <div style={{ display: 'flex', gap: '6px', fontSize: '13px', alignItems: 'center', flexWrap: 'wrap', fontFamily: "'VT323', monospace" }}>
            <span style={{ color: 'var(--gold-on-grey, #7a5c00)' }}>
              {formatNumber(dev.balance_nxt)} $NXT
            </span>
            <span style={{ color: 'var(--text-muted, #888)' }}>{dev.mood || '-'}</span>
            <span style={{
              color: dev.status === 'active' ? 'var(--green-on-grey, #005500)' : dev.status === 'on_mission' ? '#2d8a2d' : dev.status === 'resting' ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)',
              textTransform: 'uppercase', fontWeight: 'bold',
            }}>{dev.status || 'active'}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Vital Stats — 2 column grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px',
        marginBottom: '4px', width: '100%',
      }}>
        <VitalBar iconType="energy" label="Energy" value={dev.energy ?? 0} max={dev.max_energy ?? 10} />
        <VitalBar iconType="bugs" label="Bugs" value={bugsVal} max={bugsMax} inverse />
        <VitalBar iconType="pc" label="PC Health" value={pcHealth} max={100} />
        <VitalBar iconType="social" label="Social" value={social} max={100} />
        <VitalBar iconType="knowledge" label="Knowledge" value={knowledge} max={100} />
        <VitalBar iconType="caffeine" label="Caffeine" value={caffeine} max={100} />
      </div>

      {/* Row 3: Training status */}
      {dev.training_course && (
        <div style={{
          fontSize: '13px', color: '#b8860b', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontFamily: "'VT323', monospace",
        }}>
          [TRAIN] {SHOP_ITEMS_MAP[dev.training_course] || dev.training_course}
          {dev.training_ends_at && new Date(dev.training_ends_at) <= new Date() ? (
            <StoneBtn emoji={'\uD83C\uDF93'} label="GRAD"
              onClick={doGraduate} disabled={busy}
              title="Complete training and apply stat bonus" />
          ) : dev.training_ends_at ? (
            <span style={{ color: '#888' }}> ({Math.max(0, Math.ceil((new Date(dev.training_ends_at) - new Date()) / 3600000))}h left)</span>
          ) : null}
        </div>
      )}

      {/* Row 4: Action Buttons — grid 6 cols, aligned to stats width */}
      {address && !dev._fetchFailed && !onMission && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '4px', width: '100%' }}>
          <StoneBtn emoji={'\u2615'} label="COFFEE"
            onClick={(e) => doShopAction(e, 'coffee', 'Coffee')}
            disabled={busy}
            title="Coffee: 3 $NXT \u2192 +25 Caffeine" />
          <StoneBtn emoji={'\uD83C\uDF54'} label="FEED"
            onClick={(e) => doShopAction(e, 'pizza', 'Hamburger')}
            disabled={busy || energyHigh}
            title={energyHigh ? "Energy is OK" : "Hamburger: 8 $NXT \u2192 +15 Energy"} />
          <HackDropdown dev={dev} busy={busy}
            onHackMainframe={doHackMainframe} onHackPlayer={doHackPlayer} />
          <StoneBtn emoji={'\uD83D\uDD27'} label={bugsVal > 0 ? `FIX:${bugsVal}` : 'FIX'}
            onClick={doFixBug} disabled={busy || bugsVal <= 0}
            title={bugsVal > 0 ? `Fix Bugs: 5 Energy \u2192 -8 Bugs, +3 Knowledge (${bugsVal} bugs)` : 'No bugs to fix'} />
          <StoneBtn emoji={'\uD83D\uDDA5\uFE0F'} label="REPAIR"
            onClick={(e) => doShopAction(e, 'pc_repair', 'PC Repair')}
            disabled={busy || pcHealth >= 100}
            title={pcHealth >= 100 ? "PC is healthy" : `PC Repair: 8 $NXT \u2192 100% (${pcHealth}%)`} />
          <EconDropdown dev={dev} allDevs={allDevs} busy={busy}
            onFund={(e) => { e.stopPropagation(); setShowFundModal(true); }}
            onTransfer={(e) => { e.stopPropagation(); setShowTransferModal(true); }} />
        </div>
      )}

      {/* Action feedback */}
      {actionMsg && (
        <div style={{ fontSize: '10px', color: actionMsg.color, fontWeight: 'bold', marginBottom: '2px',
          fontFamily: "'VT323', monospace" }}>
          {actionMsg.text}
        </div>
      )}

      {/* Row 5: Footer counters + prompt */}
      <div style={{
        display: 'flex', gap: '8px', fontSize: '12px',
        color: 'var(--text-muted, #888)', marginBottom: address ? '2px' : 0,
        fontFamily: "'VT323', monospace", padding: '2px 0',
      }}>
        {dev.coffee_count > 0 && <span>caf:{dev.coffee_count}</span>}
        {dev.lines_of_code > 0 && <span>LoC:{formatNumber(dev.lines_of_code)}</span>}
        {dev.hours_since_sleep > 0 && <span>nosleep:{dev.hours_since_sleep}h</span>}
        {dev.last_action_type && (
          <span style={{ color: 'var(--cyan-on-grey, #006677)' }}>
            [{dev.last_action_type.replace(/_/g, ' ')}]
          </span>
        )}
      </div>

      {address && (
        <QuickPrompt devId={dev.token_id} devName={dev.name} address={address} />
      )}

      {/* Fund / Transfer modals */}
      {showFundModal && (
        <FundModal dev={dev} address={address} onClose={() => setShowFundModal(false)} onDevUpdate={onDevUpdate} />
      )}
      {showTransferModal && (
        <TransferModal dev={dev} allDevs={allDevs} address={address} onClose={() => setShowTransferModal(false)} onDevUpdate={onDevUpdate} />
      )}

      {/* On Mission overlay */}
      {onMission && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '6px', zIndex: 2,
        }} onClick={e => e.stopPropagation()}>
          <span style={{
            fontSize: '16px', fontWeight: 'bold', color: '#2d8a2d',
            textTransform: 'uppercase', letterSpacing: '2px',
            textShadow: '0 0 6px rgba(45, 138, 45, 0.5)',
            animation: 'mission-pulse 2s ease-in-out infinite',
          }}>⏳ ON MISSION</span>
          {mission && (
            <>
              <span style={{ fontSize: '11px', color: '#ccc', maxWidth: '80%', textAlign: 'center' }}>
                {mission.title}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 'bold',
                color: missionCompleted ? '#44ff44' : '#ffcc00',
              }}>
                {missionCompleted ? 'MISSION COMPLETE!' : `Returns in ${(() => {
                  const diff = new Date(mission.ends_at) - new Date();
                  if (diff <= 0) return 'now';
                  const h = Math.floor(diff / 3600000);
                  const m = Math.floor((diff % 3600000) / 60000);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                })()}`}
              </span>
            </>
          )}
          {missionCompleted && (
            <button className="win-btn" onClick={doClaimMission} disabled={busy}
              style={{
                fontSize: '14px', padding: '6px 16px', fontWeight: 'bold',
                color: '#005500', border: '2px solid #005500',
                background: '#e8ffe8', cursor: 'pointer',
              }}>
              CLAIM: +{mission.reward_nxt} $NXT
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Dev action notification types shown in Activity tab
const DEV_ACTION_NOTIF_TYPES = ['protocol_created', 'ai_created', 'invest', 'sell', 'code_review'];

const ACTION_ICONS = {
  protocol_created: '[P]',
  ai_created: '[AI]',
  invest: '[$$]',
  sell: '[$$]',
  code_review: '[CR]',
  prompt_response: '[>]',
};

const ACTION_COLORS = {
  protocol_created: 'var(--terminal-green, #33ff33)',
  ai_created: 'var(--terminal-cyan, #00ffff)',
  invest: 'var(--gold, #ffd700)',
  sell: 'var(--gold, #ffd700)',
  code_review: 'var(--terminal-amber, #ffaa00)',
  prompt_response: 'var(--terminal-green, #33ff33)',
};

function formatActivityTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ActivityTab({ walletAddress, devs }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDev, setFilterDev] = useState('all');

  useEffect(() => {
    if (!walletAddress) { setLoading(false); return; }

    const fetchActivities = () => {
      api.getNotifications(walletAddress)
        .then(notifs => {
          if (!Array.isArray(notifs)) { setActivities([]); return; }
          const devActions = notifs.filter(n => DEV_ACTION_NOTIF_TYPES.includes(n.type));
          setActivities(devActions);
        })
        .catch(() => setActivities([]))
        .finally(() => setLoading(false));
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (loading) return <div className="loading">Loading activity...</div>;

  const filtered = filterDev === 'all'
    ? activities
    : activities.filter(a => a.dev_id === Number(filterDev));

  // Build dev name map
  const devNameMap = {};
  (devs || []).forEach(d => { devNameMap[d.token_id] = d.name; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '11px',
      }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-muted, #888)' }}>Filter:</span>
        <select
          value={filterDev}
          onChange={(e) => setFilterDev(e.target.value)}
          style={{
            fontSize: '11px', padding: '2px 4px',
            background: 'var(--bg-primary, #fff)',
            border: '1px solid var(--border-dark, #808080)',
          }}
        >
          <option value="all">All Devs ({activities.length})</option>
          {(devs || []).map(d => {
            const count = activities.filter(a => a.dev_id === d.token_id).length;
            return (
              <option key={d.token_id} value={d.token_id}>
                {d.name || `Dev #${d.token_id}`} ({count})
              </option>
            );
          })}
        </select>
        <span style={{ color: 'var(--text-muted, #888)', marginLeft: 'auto' }}>
          {filtered.length} action{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Activity list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center',
            fontFamily: "'VT323', monospace", fontSize: '14px',
            color: 'var(--terminal-amber)',
          }}>
            {'>'} No dev actions recorded yet.
          </div>
        ) : (
          <div className="terminal" style={{ padding: '4px 8px' }}>
            {filtered.map((a, i) => {
              const icon = ACTION_ICONS[a.type] || '[?]';
              const color = ACTION_COLORS[a.type] || '#888';
              const devName = devNameMap[a.dev_id] || (a.dev_id ? `Dev #${a.dev_id}` : '');
              return (
                <div key={a.id || i} style={{
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  lineHeight: 1.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color, fontWeight: 'bold', fontFamily: "'VT323', monospace", fontSize: '15px', flexShrink: 0 }}>
                      {icon}
                    </span>
                    <span style={{ fontWeight: 'bold', color, fontSize: '13px', fontFamily: "'VT323', monospace" }}>
                      {a.title}
                    </span>
                    <span style={{ marginLeft: 'auto', color: '#999', fontSize: '12px', flexShrink: 0, fontFamily: "'VT323', monospace" }}>
                      {formatActivityTime(a.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', color: '#bbb',
                    marginTop: '2px', paddingLeft: '30px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: "'VT323', monospace",
                  }}>
                    {devName && (
                      <span style={{ color: 'var(--terminal-cyan, #00ffff)', fontWeight: 'bold' }}>
                        {devName}:{' '}
                      </span>
                    )}
                    {a.body ? a.body.slice(0, 200) : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyDevs({ openDevProfile }) {
  const { address, isConnected, connect, displayAddress } = useWallet();
  const { devs, loading, fetchError, refreshDevs, updateDev, tokenIds } = useDevs();
  const [tab, setTab] = useState('devs');
  const [activityCount, setActivityCount] = useState(0);
  const [missionMap, setMissionMap] = useState({}); // devTokenId → mission info
  const [, setRefreshTick] = useState(0);
  const [hackResult, setHackResult] = useState(null);
  const [hackError, setHackError] = useState(null);

  // Fetch active missions to show on-mission state in DevCards
  useEffect(() => {
    if (!address) return;
    api.getMissionsActive(address).then(missions => {
      const map = {};
      for (const m of (missions || [])) {
        map[m.dev_token_id] = m;
      }
      setMissionMap(map);
    }).catch(() => {});
  }, [address]);

  // Auto-refresh every 30s to detect completed missions (FIX 2)
  const hasMissions = Object.keys(missionMap).length > 0;
  useEffect(() => {
    if (!address || !hasMissions) return;
    const interval = setInterval(() => {
      setRefreshTick(t => t + 1);
      api.getMissionsActive(address).then(missions => {
        const map = {};
        for (const m of (missions || [])) map[m.dev_token_id] = m;
        setMissionMap(map);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [address, hasMissions]);

  // Fetch activity count for badge
  useEffect(() => {
    if (!address) return;
    api.getNotifications(address)
      .then(notifs => {
        if (!Array.isArray(notifs)) return;
        const unread = notifs.filter(n => DEV_ACTION_NOTIF_TYPES.includes(n.type) && !n.read).length;
        setActivityCount(unread);
      })
      .catch(() => {});
  }, [address]);

  const isLoadingAny = loading;

  const headerStyle = {
    padding: '6px 8px',
    background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
    fontSize: '14px',
    borderBottom: '1px solid var(--border-dark)',
    display: 'flex', justifyContent: 'space-between',
  };

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ ...headerStyle, color: 'var(--terminal-amber)' }}>
          {'>'} MY DEVELOPERS
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace", color: 'var(--text-muted, #555)' }}>[@]</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            Connect wallet to see your devs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
            Your developers will appear here once your wallet is connected.
          </div>
          <button className="win-btn" onClick={connect} style={{ padding: '4px 20px', fontWeight: 'bold' }}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!loading && devs.length === 0 && !fetchError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ ...headerStyle, color: 'var(--terminal-green)' }}>
          <span>{'>'} MY DEVELOPERS</span>
          <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace", color: 'var(--text-muted, #555)' }}>[+]</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            No devs yet
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
            Open Mint/Hire Devs to get started!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...headerStyle, color: 'var(--terminal-green)' }}>
        <span>
          {'>'} MY DEVELOPERS ({isLoadingAny && devs.length === 0 ? '...' : devs.length})
          {' '}
          <button
            className="win-btn"
            onClick={() => { refreshDevs(); }}
            style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '6px', cursor: 'pointer' }}
          >
            {loading && devs.length > 0 ? '...' : '\u21bb'} Refresh
          </button>
        </span>
        <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
      </div>

      {/* Tabs */}
      <div className="win-tabs">
        <button className={`win-tab${tab === 'devs' ? ' active' : ''}`} onClick={() => setTab('devs')}>
          Devs
        </button>
        <button className={`win-tab${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
          Activity{activityCount > 0 ? ` (${activityCount})` : ''}
        </button>
      </div>

      {fetchError && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-red)',
          color: 'var(--terminal-red)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
        }}>
          [X] {fetchError}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'devs' && (
          <div style={{ height: '100%', overflow: 'auto', padding: '4px', position: 'relative' }}>
            {isLoadingAny && devs.length === 0 ? (
              <LoadingLore />
            ) : (
              devs.map((dev) => (
                <DevCard
                  key={dev.token_id}
                  dev={dev}
                  address={address}
                  allDevs={devs}
                  mission={missionMap[dev.token_id]}
                  onClick={() => openDevProfile?.(dev.token_id)}
                  onHackResult={setHackResult}
                  onHackError={setHackError}
                  onRetry={(id) => {
                    api.getDev(id, address).then(fresh => {
                      if (fresh && !fresh._fetchFailed) {
                        updateDev(fresh);
                      }
                    }).catch(() => {});
                  }}
                  onDevUpdate={(fresh) => {
                    updateDev(fresh);
                    // Refresh missions after claiming
                    api.getMissionsActive(address).then(missions => {
                      const map = {};
                      for (const m of (missions || [])) map[m.dev_token_id] = m;
                      setMissionMap(map);
                    }).catch(() => {});
                  }}
                />
              ))
            )}
            {loading && devs.length > 0 && (
              <div style={{
                position: 'absolute', top: '4px', right: '8px',
                background: 'var(--terminal-bg, #111)', border: '1px solid var(--border-dark, #444)',
                padding: '2px 8px', fontSize: '11px', fontFamily: "'VT323', monospace",
                color: 'var(--terminal-amber, #ffaa00)', opacity: 0.9,
              }}>
                Refreshing...
              </div>
            )}
          </div>
        )}
        {tab === 'activity' && (
          <ActivityTab walletAddress={address} devs={devs} />
        )}
      </div>
      <HackResultModal result={hackResult} onClose={() => setHackResult(null)} />
      <HackErrorModal error={hackError} onClose={() => setHackError(null)} />
    </div>
  );
}
