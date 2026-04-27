import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { formatUnits } from 'viem';
import { useWallet } from '../hooks/useWallet';
import { isUserRejection, toReadableMessage } from '../hooks/walletErrors';
import { api } from '../services/api';
import { useDevs } from '../contexts/DevsContext';
import { NXT_TOKEN_ADDRESS, TREASURY_ADDRESS, ERC20_TRANSFER_ABI } from '../services/contract';
import { playSpendSound, playGainSound, playActionSound } from '../utils/sound';

const MAINNET_RPC = 'https://mainnet.megaeth.com/rpc';

const ARCHETYPE_COLORS = {
  '10X_DEV': 'var(--red-on-grey, #aa0000)', 'LURKER': 'var(--common-on-grey, #333333)', 'DEGEN': 'var(--gold-on-grey, #7a5c00)',
  'GRINDER': 'var(--blue-on-grey, #0d47a1)', 'INFLUENCER': 'var(--pink-on-grey, #660066)', 'HACKTIVIST': 'var(--green-on-grey, #005500)',
  'FED': 'var(--amber-on-grey, #7a5500)', 'SCRIPT_KIDDIE': 'var(--cyan-on-grey, #005060)',
};

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

const SHOP_ITEMS_MAP = {
  class_hacking: 'Hacking 101', class_coding: 'Code Fundamentals', class_trading: 'Trading Basics',
  class_social: 'Social Engineering', class_endurance: 'Endurance Training',
  course_hacking: 'Speed Hacking', course_coding: 'Rapid Coding', course_trading: 'Quick Trading',
  course_social: 'Fast Networking', course_endurance: 'Power Endurance',
  train_hacking: 'Intro to Hacking', train_coding: 'Optimization Workshop', train_trading: 'Advanced AI Trading',
};

const BOOT_LINES = [
  { text: 'NX TERMINAL — Developer Retrieval System v4.2', color: '#8B0000', delay: 0 },
  { text: 'Establishing secure connection to MegaETH...', color: '#333', delay: 300 },
  { text: 'Chain ID: 4326 .......................... OK', color: 'var(--text-secondary)', delay: 600 },
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
      fontSize: 'var(--text-base)',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}>
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
      <span style={{ width: '18px', textAlign: 'right', color, fontWeight: 'bold', fontSize: 'var(--text-xs)' }}>{value || 0}</span>
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
            // Tight PFP crop: scale 2.2× and pin the origin to 32% from
            // the top so the bunny's head / neck / whiskers land in the
            // middle of the 80×80 frame. The parent div is already
            // overflow: hidden so the extra pixels get clipped. This
            // only applies to MyDevs cards — DevProfile renders its own
            // inline <img> and is untouched.
            transform: 'scale(2.2)',
            transformOrigin: 'center 32%',
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
          color: 'var(--text-muted, #555)', fontSize: 'var(--text-xs)',
          fontFamily: "'VT323', monospace",
          background: status === 'loading' ? undefined : 'var(--terminal-bg, #111)',
        }}>
          {status === 'loading' ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted, #666)', animation: 'pulse 1.5s infinite' }}>...</div>
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

// ── Dev Image Modal — PFP / FULL BODY toggle + downloads ─────
// In-app modal that replaces the old window.open popup. Win98/terminal
// aesthetic matching the rest of the app. Shows the dev's GIF in one
// of two modes:
//
//   PFP       — scale(2.2) + transformOrigin center 32% (same crop as
//               the grid thumbnails and the LiveFeed avatars)
//   FULL BODY — full frame, un-zoomed
//
// Downloads respect whatever mode is active:
//   ↓ GIF — always the original IPFS GIF via fetch+blob (cheap, always
//           works, the animated frames preserve). Cropping a GIF in
//           canvas is not feasible without GIF decoding, so the GIF
//           download is always full-frame regardless of mode.
//   ↓ PNG — a still snapshot rendered to 1000×1000 canvas. In PFP
//           mode the canvas drawImage math reproduces the exact
//           scale(2.2) + center 32% crop:
//             scale = 2.2, origin = (0.5, 0.32) of container
//             imgSize = 1000 × 2.2 = 2200
//             dx = -(2200*0.5 - 1000*0.5) = -600
//             dy = -(2200*0.32 - 1000*0.32) = -384
//             ctx.drawImage(img, -600, -384, 2200, 2200)
//           In FULL BODY mode it's a straight drawImage(img, 0, 0, 1000, 1000).
function DevImageModal({ dev, onClose }) {
  const [mode, setMode] = useState('pfp');
  const imgRef = useRef(null);
  const [dlStatus, setDlStatus] = useState(null);

  // ── Draggable window state ──────────────────────────────
  // Initial position: centered on the viewport. Modal is ~440 wide
  // and ~530 tall, so half of each gives us the centering offset.
  // Math.max(20, …) keeps the modal on-screen on tiny viewports.
  const [pos, setPos] = useState(() => ({
    x: Math.max(20, Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1024) / 2 - 220)),
    y: Math.max(20, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 768) / 2 - 265)),
  }));
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Document-level mousemove/mouseup while dragging. Clamps pos so
  // at least a sliver of the window stays on-screen in every
  // direction (~60px horizontal, header height vertical).
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 36;
      const minX = -380; // allow dragging most of the 440-wide modal off left
      setPos({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const gifUrl = `${IPFS_GW}${dev.ipfs_hash}`;
  const safeFileBase = String(dev.name || `dev_${dev.token_id}`).replace(/[^A-Za-z0-9_-]/g, '_');

  const downloadGif = async () => {
    try {
      setDlStatus('Downloading GIF...');
      const res = await fetch(gifUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${safeFileBase}_${dev.token_id}.gif`;
      a.click();
      setTimeout(() => setDlStatus(null), 1500);
    } catch {
      setDlStatus('GIF download failed');
      setTimeout(() => setDlStatus(null), 2500);
    }
  };

  const downloadPng = () => {
    const img = imgRef.current;
    if (!img || !img.complete) {
      setDlStatus('Image not ready');
      setTimeout(() => setDlStatus(null), 2000);
      return;
    }
    try {
      setDlStatus('Rendering PNG...');
      const SIZE = 1000;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      if (mode === 'pfp') {
        // Reproduce scale(2.2) + transformOrigin center 32% crop.
        const scale = 2.2;
        const scaled = SIZE * scale;
        const dx = -(scaled * 0.5 - SIZE * 0.5);
        const dy = -(scaled * 0.32 - SIZE * 0.32);
        ctx.drawImage(img, dx, dy, scaled, scaled);
      } else {
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          setDlStatus('PNG render failed');
          setTimeout(() => setDlStatus(null), 2500);
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeFileBase}_${dev.token_id}_${mode}.png`;
        a.click();
        setTimeout(() => setDlStatus(null), 1500);
      }, 'image/png');
    } catch {
      setDlStatus('PNG render failed (CORS?)');
      setTimeout(() => setDlStatus(null), 2500);
    }
  };

  // Any pointer event that starts inside the modal (click, mousedown,
  // pointerdown) is stopped at the root of the modal so it never
  // bubbles up to the parent DevCard whose onClick opens DevProfile.
  // Without this, interacting with the modal tabs, buttons or drag
  // handle would incidentally open the Dev Profile window behind it.
  const stopAll = (e) => { e.stopPropagation(); };

  return (
    <>
      {/* Backdrop — separate sibling so the modal box can use
          position: fixed with dynamic left/top without fighting a
          flex centering parent. Backdrop click still closes, but
          all pointer events are stopped at the backdrop so they
          never reach the DevCard underneath. */}
      <div
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseDown={stopAll}
        onPointerDown={stopAll}
        style={{
          position: 'fixed', inset: 0, zIndex: 20000,
          background: 'rgba(0, 0, 0, 0.65)',
        }}
      />
      <div
        onClick={stopAll}
        onMouseDown={stopAll}
        onPointerDown={stopAll}
        style={{
          position: 'fixed',
          left: pos.x, top: pos.y,
          zIndex: 20001,
          width: '440px', background: '#0c0e16',
          border: '2px solid #1a1e2c',
          boxShadow: '0 0 0 1px #30d86855, 4px 4px 0 rgba(0,0,0,0.5)',
          color: '#c8ccd8',
          fontFamily: "'VT323', monospace",
        }}
      >
        {/* Header — acts as the drag handle (Win98 title bar style).
            Clicks on buttons inside the header (the close X) are
            ignored via an e.target.closest('button') check so they
            still fire their own onClick. preventDefault stops the
            browser from starting a text selection during drag. */}
        <div
          onMouseDown={(e) => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            setDragging(true);
            dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: '1px solid #1a1e2c',
            background: '#0a0c14',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 'var(--text-lg)', letterSpacing: '0.5px' }}>
            {dev.name} <span style={{ color: '#30d868' }}>#{dev.token_id}</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: '1px solid #30d86855',
              color: '#c8ccd8', cursor: 'pointer', width: '22px', height: '22px',
              fontFamily: 'inherit', fontSize: 'var(--text-base)', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >x</button>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: '4px', padding: '8px 12px 0',
        }}>
          {[
            { id: 'pfp',  label: 'PFP' },
            { id: 'full', label: 'FULL BODY' },
          ].map(t => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                style={{
                  flex: 1, padding: '4px 8px',
                  background: active ? '#30d868' : 'transparent',
                  color: active ? '#080810' : '#c8ccd8',
                  border: '1px solid #30d86855',
                  fontFamily: 'inherit', fontSize: 'var(--text-base)',
                  fontWeight: active ? 'bold' : 'normal',
                  letterSpacing: '0.5px', cursor: 'pointer',
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* Image viewport */}
        <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '360px', height: '360px',
            background: '#1a1a2e', border: '1px solid #1a1e2c',
            overflow: 'hidden', position: 'relative',
          }}>
            <img
              ref={imgRef}
              src={gifUrl}
              alt={dev.name}
              crossOrigin="anonymous"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                imageRendering: 'pixelated', display: 'block',
                transform: mode === 'pfp' ? 'scale(2.2)' : 'none',
                transformOrigin: mode === 'pfp' ? 'center 32%' : 'center center',
              }}
            />
          </div>
        </div>

        {/* Download buttons */}
        <div style={{
          display: 'flex', gap: '8px', padding: '0 12px 12px',
        }}>
          <button
            onClick={mode === 'pfp' ? undefined : downloadGif}
            disabled={mode === 'pfp'}
            title={mode === 'pfp'
              ? 'Cropped GIF not available yet — use PNG for the PFP view.'
              : 'Download the full animated GIF'}
            style={{
              flex: 1, padding: '6px 10px',
              background: mode === 'pfp' ? '#5a6278' : '#30d868',
              color: mode === 'pfp' ? '#a0a6b8' : '#080810',
              border: 'none',
              cursor: mode === 'pfp' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: 'bold',
              letterSpacing: '0.5px',
              opacity: mode === 'pfp' ? 0.65 : 1,
            }}
          >{'\u2193'} GIF</button>
          <button
            onClick={downloadPng}
            style={{
              flex: 1, padding: '6px 10px',
              background: '#30d868', color: '#080810',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: 'bold',
              letterSpacing: '0.5px',
            }}
          >{'\u2193'} PNG</button>
        </div>

        {/* Status line + hint */}
        <div style={{
          padding: '0 12px 10px', fontSize: 'var(--text-sm)',
          color: dlStatus ? '#30d868' : '#5a6278', minHeight: '14px',
          textAlign: 'center',
        }}>
          {dlStatus || (mode === 'pfp'
            ? 'PFP: head/neck crop. GIF disabled in this view — use PNG for the cropped download.'
            : 'FULL BODY: complete frame. PNG renders 1000×1000.')}
        </div>
      </div>
    </>
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
          fontSize: 'var(--text-xs)', color: 'var(--terminal-green, #33ff33)',
          fontFamily: "'VT323', monospace",
        }}>
          Order sent to {devName}!
        </span>
      ) : status === 'busy' ? (
        <span style={{
          fontSize: 'var(--text-xs)', color: 'var(--terminal-amber, #ffaa00)',
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
              fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm)', outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            className="win-btn"
            onClick={handleSend}
            disabled={!text.trim() || status === 'sending'}
            style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', flexShrink: 0, fontWeight: 'bold' }}
          >
            {status === 'sending' ? '..' : '>'}
          </button>
          {status === 'error' && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--terminal-red, #ff4444)' }}>err</span>
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

// Block explorer for MegaETH — same source of truth used elsewhere
// in the app (components/programs/monad-build/constants/monad.js).
const MEGAETH_EXPLORER_TX = (hash) => `https://mega.etherscan.io/tx/${hash}`;

// Copy of how truncated hashes render elsewhere in the project
// (0xabcdef...1234). Used in the pending modal.
const truncateHash = (h) => (h && h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || '');

// Dynamic status copy keyed on the retry attempt count reported by
// /api/shop/pending-funds/status/{tx_hash}. Keeps the user informed
// as the backend worker churns through its exponential-backoff cycle.
function pendingStatusMessage(attempts) {
  if (!attempts || attempts <= 0) {
    return 'Verifying transaction on-chain...';
  }
  if (attempts <= 5) {
    return `Credit in progress (attempt ${attempts})...`;
  }
  if (attempts <= 15) {
    return `Credit in progress (attempt ${attempts}). This usually completes in under 2 min.`;
  }
  if (attempts <= 19) {
    return `Credit taking longer than usual (attempt ${attempts}). Waiting for next retry...`;
  }
  return 'Credit taking significantly longer. An admin has been notified. Your funds are safe — they will be credited automatically.';
}

// Pending-credit view rendered inside FundModal when stage === 'pending'.
// Matches the Win98 retro chrome of the surrounding modal: .win-panel
// sunken blocks, --win-title-l/r gradient accents, VT323 monospace
// for the tx hash, --amber-on-grey / --terminal-amber for warning
// accents. Kept in-file (not /components) to mirror the locality
// pattern used by the other inline Modal components in MyDevs.jsx.
function PendingCreditView({ dev, amount, txHash, attempts, copied, onCopy, onClose }) {
  const hashDisplay = truncateHash(txHash);
  const progressUnits = 20;
  const filled = Math.max(0, Math.min(attempts ?? 0, progressUnits));
  const statusMsg = pendingStatusMessage(attempts);
  const isLate = (attempts ?? 0) >= 16;

  return (
    <div style={{ fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif" }}>
      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{
          fontSize: 'var(--text-base)', fontWeight: 'bold',
          color: 'var(--win-title-l, #000080)',
          letterSpacing: '0.5px',
        }}>
          {'\u23F3'} Transaction Pending
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Credit in Progress
        </div>
      </div>

      {/* Transaction details — sunken panel */}
      <div className="win-panel" style={{
        padding: '8px 10px', marginBottom: '10px', fontSize: 'var(--text-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
          <span style={{
            fontWeight: 'bold',
            color: 'var(--gold-on-grey, #7a5c00)',
            fontFamily: "'VT323', monospace",
            fontSize: 'var(--text-base)',
          }}>
            {amount ?? '?'} $NXT
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>To dev</span>
          <span style={{ fontWeight: 'bold' }}>{dev.name}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '4px', gap: '6px',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tx hash</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <code style={{
              fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
              background: 'var(--terminal-bg, #0c0c0c)',
              color: 'var(--terminal-green, #33ff33)',
              padding: '1px 6px',
            }}>
              {hashDisplay}
            </code>
            <button
              className="win-btn"
              onClick={onCopy}
              disabled={!txHash}
              title="Copy full tx hash to clipboard"
              style={{ fontSize: 'var(--text-xs)', padding: '1px 6px' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <a
            href={txHash ? MEGAETH_EXPLORER_TX(txHash) : undefined}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--blue-on-grey, #0d47a1)',
              textDecoration: 'underline',
            }}
          >
            View on MegaETH Explorer ↗
          </a>
        </div>
      </div>

      {/* Status + Win98-style progress bar */}
      <div className="win-panel" style={{
        padding: '8px 10px', marginBottom: '10px',
        background: 'rgba(255, 170, 0, 0.08)',
      }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          color: isLate
            ? 'var(--red-on-grey, #aa0000)'
            : 'var(--amber-on-grey, #7a5500)',
          marginBottom: '6px', lineHeight: 1.4,
        }}>
          {statusMsg}
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progressUnits}
          aria-valuenow={filled}
          style={{
            display: 'flex', gap: '2px', padding: '3px',
            background: '#fff', border: '2px inset #888',
          }}
        >
          {Array.from({ length: progressUnits }).map((_, i) => (
            <span key={i} style={{
              flex: 1, height: '8px',
              background: i < filled
                ? 'var(--win-title-l, #000080)'
                : 'transparent',
            }} />
          ))}
        </div>
      </div>

      {/* Close and continue */}
      <button
        className="win-btn"
        onClick={onClose}
        title="Your tx is safe. The backend will credit your dev automatically in the next few seconds/minutes."
        style={{
          width: '100%', padding: '6px', fontSize: 'var(--text-base)', fontWeight: 'bold',
        }}
      >
        Close and continue
      </button>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
        marginTop: '6px', textAlign: 'center', lineHeight: 1.3,
      }}>
        Your $NXT is on-chain. It's safe to close this window — the
        credit will apply automatically in the background.
      </div>
    </div>
  );
}

// ── Fund Modal ────────────────────────────────────────────
function FundModal({ dev, address, onClose, onDevUpdate }) {
  const { writeContract } = useWallet();
  const [amount, setAmount] = useState('');
  const [walletBal, setWalletBal] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | signing | mining | pending | success | error
  const [errorMsg, setErrorMsg] = useState('');
  // If the on-chain tx confirmed but the backend POST failed, we keep the
  // hash + amount here so "Try Again" retries the backend call with the same
  // tx instead of signing (and paying for) a fresh one.
  const [pendingTx, setPendingTx] = useState(null); // { hash, amount } | null
  // Hash of the tx that landed in `pending` stage — drives the status poller
  // below. Separate from `pendingTx` because pendingTx is cleared on entering
  // the pending stage (so the close-guard stops warning).
  const [pendingStatusHash, setPendingStatusHash] = useState(null);
  // Amount committed to the pending tx, kept for display after pendingTx
  // is cleared on entering the pending stage.
  const [pendingAmount, setPendingAmount] = useState(null);
  // Latest `attempts` value reported by the status poll — drives the
  // dynamic status copy in the pending stage UI.
  const [pollAttempts, setPollAttempts] = useState(0);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!address) return;
    fetchWalletNxtBalance(address)
      .then(wei => setWalletBal(Number(formatUnits(wei, 18))))
      .catch(() => setWalletBal(null));
  }, [address]);

  // While the tx is sitting in pending_fund_txs, poll the backend every 15s.
  // Flip to 'success' the moment the engine worker credits it so the user
  // sees the updated balance instead of waiting out the 4.5s close timeout.
  useEffect(() => {
    if (stage !== 'pending' || !pendingStatusHash) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.getPendingFundStatus(pendingStatusHash);
        if (cancelled) return;
        if (res?.status === 'credited') {
          setStage('success');
          setPendingStatusHash(null);
          return;
        }
        if (typeof res?.attempts === 'number') setPollAttempts(res.attempts);
      } catch {
        // Transient failures are fine — next tick retries.
      }
    };
    // Fire once right away so the user doesn't wait 15s for the first
    // status reading (the worker may already have credited by the time
    // the modal reaches this stage).
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [stage, pendingStatusHash]);

  const amountNum = parseInt(amount, 10) || 0;
  const hasPending = pendingTx !== null;
  const canFund = (
    stage === 'idle'
    && (hasPending || (amountNum > 0 && walletBal !== null && amountNum <= walletBal))
  );

  const doFund = async () => {
    if (!canFund) return;
    setErrorMsg('');
    try {
      let txHash = pendingTx?.hash;
      let committedAmount = pendingTx?.amount ?? amountNum;

      if (!txHash) {
        // No pending tx — sign and send a fresh on-chain transfer.
        setStage('signing');
        const amountWei = BigInt(amountNum) * BigInt(10 ** 18);

        txHash = await writeContract({
          address: NXT_TOKEN_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [TREASURY_ADDRESS, amountWei],
        });

        setStage('mining');
        const receipt = await waitForReceipt(txHash);
        if (receipt.status !== '0x1') throw new Error('Transaction reverted');

        // Tx is on-chain — persist before we call the backend so a failed
        // backend POST doesn't orphan the user's funds.
        setPendingTx({ hash: txHash, amount: amountNum });
        committedAmount = amountNum;
      } else {
        // Retry path — the on-chain tx already confirmed previously.
        setStage('mining');
      }

      // Report to backend (new or retried).
      const res = await api.fundDev(address, dev.token_id, committedAmount, txHash);
      if (res && res.status === 'pending') {
        // Backend couldn't fetch the receipt in time but persisted the tx
        // in pending_fund_txs — the engine worker will credit the dev once
        // the RPC node indexes it. Clear the client-side pendingTx so the
        // user can close without the warning dialog, and remember the hash
        // so the status poller can upgrade stage → success on credit.
        setStage('pending');
        setPendingTx(null);
        setPendingStatusHash(txHash);
        setPendingAmount(committedAmount);
        setPollAttempts(0);
        return;
      }
      setStage('success');
      setPendingTx(null);
      if (res.updated_dev && onDevUpdate) onDevUpdate(res.updated_dev);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      // Option A: a deliberate cancellation isn't an error from the
      // user's POV. Reset to idle so FUND is clickable again. pendingTx
      // stays null naturally because setPendingTx only fires after the
      // on-chain receipt — a rejection mid-signing has nothing to
      // preserve.
      if (isUserRejection(err)) {
        setStage('idle');
        setErrorMsg('');
        return;
      }
      // Other failures: revert, network, backend POST after a confirmed
      // tx, etc. If pendingTx was already populated above, keep it so the
      // next click retries the backend POST instead of signing a fresh
      // on-chain tx.
      setStage('error');
      setErrorMsg(toReadableMessage(err, 'Unknown error'));
    }
  };

  const presets = [25, 50, 100];

  const copyPendingHash = async () => {
    if (!pendingStatusHash) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pendingStatusHash);
      } else {
        // Fallback: select-and-copy in older browsers.
        const ta = document.createElement('textarea');
        ta.value = pendingStatusHash;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1500);
    } catch {
      // swallow — clipboard may be blocked; user can still click the explorer link
    }
  };

  const handleClose = () => {
    // Guard against closing with an unresolved on-chain tx — the hash would
    // be lost and the user would have to rely on the backfill reconciler.
    // In 'pending' stage the backend already persisted the tx in
    // pending_fund_txs, so no warning is needed.
    if (hasPending && stage !== 'success' && stage !== 'pending') {
      const ok = window.confirm(
        'Your on-chain $NXT transfer confirmed but the credit retry is still pending. '
        + 'Closing will drop the tx hash from this session — the backfill worker will '
        + 'still credit your dev, but it may take a few minutes. Close anyway?'
      );
      if (!ok) return;
    }
    onClose();
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
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Fund Dev</span>
          <button onClick={handleClose} style={{
            background: '#c0c0c0', border: '1px outset #fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: 'var(--text-sm)',
            padding: '0 4px', lineHeight: 1,
          }}>X</button>
        </div>

        <div style={{ padding: '12px', fontSize: 'var(--text-base)' }}>
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

          {stage === 'pending' ? (
            <PendingCreditView
              dev={dev}
              amount={pendingAmount}
              txHash={pendingStatusHash}
              attempts={pollAttempts}
              copied={copiedHash}
              onCopy={copyPendingHash}
              onClose={handleClose}
            />
          ) : (
            <>
              {/* Amount input */}
              <div style={{ marginBottom: '6px' }}>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Amount:</label>
                <input
                  type="number"
                  min="1"
                  max={walletBal ? Math.floor(walletBal) : 999999}
                  value={hasPending ? String(pendingTx.amount) : amount}
                  onChange={e => setAmount(e.target.value)}
                  disabled={stage !== 'idle' || hasPending}
                  style={{
                    width: '100%', padding: '4px 6px', fontSize: 'var(--text-base)',
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
                    disabled={stage !== 'idle' || hasPending}
                    style={{ flex: 1, fontSize: 'var(--text-sm)', padding: '2px' }}>{v}</button>
                ))}
                <button className="win-btn" onClick={() => setAmount(String(Math.floor(walletBal || 0)))}
                  disabled={stage !== 'idle' || !walletBal || hasPending}
                  style={{ flex: 1, fontSize: 'var(--text-sm)', padding: '2px' }}>ALL</button>
              </div>

              {hasPending && stage !== 'success' && (
                <div style={{
                  fontSize: 'var(--text-sm)', color: 'var(--amber-on-grey, #7a5500)',
                  background: 'rgba(255, 204, 0, 0.12)', border: '1px solid rgba(255, 204, 0, 0.4)',
                  padding: '6px 8px', marginBottom: '8px', lineHeight: 1.4,
                }}>
                  On-chain tx confirmed. Retrying credit — do NOT sign a new one.
                </div>
              )}

              {/* Action button */}
              <button className="win-btn" onClick={doFund}
                disabled={!canFund}
                style={{
                  width: '100%', padding: '6px', fontSize: 'var(--text-base)', fontWeight: 'bold',
                  color: canFund ? '#005500' : '#888',
                  border: canFund ? '2px outset #aaa' : undefined,
                }}>
                {stage === 'idle' && !hasPending && `\uD83D\uDCB0 FUND ${dev.name}`}
                {stage === 'idle' && hasPending && `\uD83D\uDD04 Retry credit (${pendingTx.amount} $NXT)`}
                {stage === 'signing' && 'Confirm in your wallet...'}
                {stage === 'mining' && (hasPending ? 'Retrying credit...' : 'Processing...')}
                {stage === 'success' && '\u2705 Funded!'}
                {stage === 'error' && '\u274C Failed — Try Again'}
              </button>

              {stage === 'error' && errorMsg && (
                <div style={{ fontSize: 'var(--text-sm)', color: '#aa0000', marginTop: '4px' }}>{errorMsg}</div>
              )}
              {stage === 'error' && (
                <button className="win-btn" onClick={() => setStage('idle')}
                  style={{ marginTop: '4px', fontSize: 'var(--text-sm)', padding: '2px 8px' }}>
                  {hasPending ? 'Retry credit' : 'Try Again'}
                </button>
              )}

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
                Transfers $NXT from your wallet to your dev's in-game balance.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transfer Modal ────────────────────────────────────────
function TransferModal({ dev, allDevs, address, onClose, onDevUpdate, mode = 'transfer' }) {
  // Shared component for both outbound ('transfer') and inbound
  // ('request') same-wallet NXT moves. The backend endpoint is the
  // same in both cases — a 'request' is just a transfer with the
  // from/to IDs swapped. The only runtime differences are the
  // labels, which dev the dropdown lists, and which side's balance
  // gates the amount. Kept in one component so any future tweak
  // (ledger wiring, validation, chrome) lands on both flows at once.
  const isRequest = mode === 'request';

  const [otherDevId, setOtherDevId] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const otherDevs = (allDevs || []).filter(d => d.token_id !== dev.token_id && !d._fetchFailed);
  const selectedDev = otherDevs.find(d => d.token_id === Number(otherDevId));
  const amountNum = parseInt(amount, 10) || 0;

  // Which side's balance gates the amount?
  //   transfer: this dev gives → must have >= amount
  //   request:  other dev gives → must have >= amount
  const sourceDev = isRequest ? selectedDev : dev;
  const sourceBalance = sourceDev ? sourceDev.balance_nxt : 0;

  const canSubmit = (
    amountNum > 0
    && selectedDev
    && amountNum <= sourceBalance
    && stage === 'idle'
    && selectedDev.status !== 'on_mission'
    && dev.status !== 'on_mission'
  );

  const doSubmit = async () => {
    if (!canSubmit) return;
    setStage('sending');
    setErrorMsg('');
    try {
      // Swap from/to when in request mode. Same endpoint, same
      // ledger entries (transfer_out + transfer_in), same audit.
      const fromId = isRequest ? Number(otherDevId) : dev.token_id;
      const toId   = isRequest ? dev.token_id : Number(otherDevId);
      const res = await api.transferNxt(address, fromId, toId, amountNum);
      setStage('success');
      if (res.updated_from && onDevUpdate) onDevUpdate(res.updated_from);
      if (res.updated_to && onDevUpdate) onDevUpdate(res.updated_to);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      setStage('error');
      setErrorMsg(err?.message || (isRequest ? 'Request failed' : 'Transfer failed'));
    }
  };

  const titleText = isRequest ? 'Request Funds' : 'Transfer Funds';
  const subtitleText = isRequest
    ? '"Pulling budget from another team. They love that."'
    : '"Reallocating the budget. Standard corporate procedure."';
  const fixedLabel = isRequest ? 'To:' : 'From:';
  const dropdownLabel = isRequest ? 'From:' : 'To:';
  const maxAmount = isRequest ? sourceBalance : dev.balance_nxt;
  const footerText = isRequest
    ? 'Pulls $NXT from another dev to this one. No blockchain transaction needed.'
    : 'Moves $NXT between your devs. No blockchain transaction needed.';

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
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{titleText}</span>
          <button onClick={onClose} style={{
            background: '#c0c0c0', border: '1px outset #fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: 'var(--text-sm)',
            padding: '0 4px', lineHeight: 1,
          }}>X</button>
        </div>

        <div style={{ padding: '12px', fontSize: 'var(--text-base)' }}>
          <div style={{ color: '#333', marginBottom: '8px', fontStyle: 'italic' }}>
            {subtitleText}
          </div>

          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>{fixedLabel}</span>{' '}
            <span style={{ color: 'var(--gold-on-grey, #7a5c00)' }}>
              {dev.name} ({formatNumber(dev.balance_nxt)} $NXT)
            </span>
          </div>

          {/* Dev selector (the counterparty — destination in transfer,
              source in request). */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>{dropdownLabel}</label>
            <select
              value={otherDevId}
              onChange={e => setOtherDevId(e.target.value)}
              disabled={stage !== 'idle'}
              style={{
                width: '100%', padding: '4px', fontSize: 'var(--text-base)',
                fontFamily: "'VT323', monospace",
                background: '#fff', border: '2px inset #888',
              }}
            >
              <option value="">Select dev...</option>
              {otherDevs.map(d => {
                const onMission = d.status === 'on_mission';
                // In request mode the counterparty supplies the funds,
                // so a zero-balance dev is effectively unusable — we
                // keep it selectable (so the user can see WHY it's
                // greyed in the message) but mark the reason.
                const noFunds = isRequest && d.balance_nxt <= 0;
                return (
                  <option key={d.token_id} value={d.token_id} disabled={onMission || noFunds}>
                    {d.name} ({formatNumber(d.balance_nxt)} $NXT){d.balance_nxt === 0 && !isRequest ? ' \u2190 needs funds!' : ''}{noFunds ? ' [NO FUNDS]' : ''}{onMission ? ' [ON MISSION]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Amount input — max adjusts with whichever dev is the source. */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Amount:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="1"
                max={maxAmount}
                value={amount}
                onChange={e => setAmount(String(Math.min(Number(e.target.value) || 0, maxAmount || 0)))}
                disabled={stage !== 'idle'}
                style={{
                  width: '100px', padding: '6px 10px', fontSize: 'var(--text-xl)',
                  fontFamily: "'VT323', monospace",
                  background: '#1a1a2e', color: '#66ff66',
                  border: '2px solid #3a5a3a', textAlign: 'center',
                  outline: 'none',
                }}
                placeholder="0"
              />
              <span style={{ fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                / {formatNumber(maxAmount)} $NXT
                {isRequest && selectedDev && (
                  <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted, #888)' }}>
                    (available in {selectedDev.name})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Action button */}
          <button className="win-btn" onClick={doSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '6px', fontSize: 'var(--text-base)', fontWeight: 'bold',
              color: canSubmit ? '#005500' : '#888',
              border: canSubmit ? '2px outset #aaa' : undefined,
            }}>
            {isRequest ? (
              <>
                {stage === 'idle' && '\uD83D\uDCE5 REQUEST'}
                {stage === 'sending' && 'Processing...'}
                {stage === 'success' && '\u2705 Received!'}
                {stage === 'error' && '\u274C Failed'}
              </>
            ) : (
              <>
                {stage === 'idle' && '\uD83D\uDCBC TRANSFER'}
                {stage === 'sending' && 'Processing...'}
                {stage === 'success' && '\u2705 Transferred!'}
                {stage === 'error' && '\u274C Failed'}
              </>
            )}
          </button>

          {stage === 'error' && errorMsg && (
            <div style={{ fontSize: 'var(--text-sm)', color: '#aa0000', marginTop: '4px' }}>{errorMsg}</div>
          )}
          {stage === 'error' && (
            <button className="win-btn" onClick={() => setStage('idle')}
              style={{ marginTop: '4px', fontSize: 'var(--text-sm)', padding: '2px 8px' }}>
              Try Again
            </button>
          )}

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
            {footerText}
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
          fontSize: 'var(--text-base)', color: '#111',
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
          fontSize: 'var(--text-base)', color,
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
        fontSize: 'var(--text-base)',
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
      {emoji && <span style={{ fontSize: 'var(--text-base)' }}>{emoji}</span>}
      {label}
    </button>
  );
}

// ── Econ Dropdown (FUND + TRANSFER + REQUEST) ───────────
function EconDropdown({ dev, allDevs, busy, onFund, onTransfer, onRequest }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // REQUEST only works if at least one OTHER dev has funds to give.
  // We don't need to check balance of `dev` itself — request is
  // inbound, so a zero-balance dev is the most likely use case.
  const requestAvailable = (allDevs || []).some(d =>
    d.token_id !== dev.token_id && !d._fetchFailed && d.balance_nxt > 0
  );

  const itemStyle = (enabled) => ({
    display: 'block', width: '100%', padding: '6px 8px', border: 'none',
    background: 'transparent',
    color: enabled ? '#1a2030' : '#555',
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
    textAlign: 'left',
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <StoneBtn emoji={'\uD83D\uDCB0'} label="ECONOMY"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        title="Fund, transfer, or request $NXT" />
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 20, background: '#6b7b8a', borderRadius: '2px', overflow: 'hidden',
          boxShadow: 'inset -2px -2px 0 #3a4654, inset 2px 2px 0 #8fa0b0, 0 3px 0 #2a3444',
        }}>
          <button onClick={(e) => { onFund(e); setOpen(false); }}
            style={itemStyle(true)}
          >{'\uD83D\uDCB0'} FUND</button>

          {allDevs && allDevs.length > 1 && (
            <button onClick={(e) => { onTransfer(e); setOpen(false); }}
              disabled={dev.balance_nxt <= 0}
              style={{ ...itemStyle(dev.balance_nxt > 0), borderTop: '2px solid #3a4654' }}
              title={dev.balance_nxt <= 0 ? 'This dev has no funds to send' : undefined}
            >{'\uD83D\uDD04'} TRANSFER</button>
          )}

          {allDevs && allDevs.length > 1 && onRequest && (
            <button onClick={(e) => { onRequest(e); setOpen(false); }}
              disabled={!requestAvailable}
              style={{ ...itemStyle(requestAvailable), borderTop: '2px solid #3a4654' }}
              title={!requestAvailable ? 'No other dev has funds to share' : 'Pull $NXT from another dev to this one'}
            >{'\uD83D\uDCE5'} REQUEST</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Feed Dropdown (CARROT / PIZZA / BURGER) ─────────────
// Mirrors EconDropdown / HackDropdown — inline styles, mousedown
// click-outside, opens upward over the button. Each option routes
// through the parent's doShopAction (passed in as onBuy) so the
// toast / updated_dev / triggerChanges plumbing is free.
function FeedDropdown({ dev, busy, onBuy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const FOOD_ITEMS = [
    { id: 'carrot', emoji: '\uD83E\uDD55', label: 'CARROT',
      cost: 8,  energy: 5,  hint: 'Carrot — 8 $NXT (+5E)' },
    { id: 'pizza',  emoji: '\uD83C\uDF55', label: 'PIZZA',
      cost: 20, energy: 10, hint: 'Pizza — 20 $NXT (+10E)' },
    { id: 'burger', emoji: '\uD83C\uDF54', label: 'BURGER',
      cost: 40, energy: 18, hint: 'Burger — 40 $NXT (+18E)' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <StoneBtn emoji={'\uD83E\uDD55'} label={'FEED \u25BE'}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        title="Feed your dev: Carrot (8), Pizza (20), Burger (40)" />
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 20, background: '#6b7b8a', borderRadius: '2px', overflow: 'hidden',
          boxShadow: 'inset -2px -2px 0 #3a4654, inset 2px 2px 0 #8fa0b0, 0 3px 0 #2a3444',
        }}>
          {FOOD_ITEMS.map((f, i) => {
            const cannotAfford = dev.balance_nxt < f.cost;
            return (
              <button
                key={f.id}
                onClick={(e) => { onBuy(e, f.id, `${f.emoji} ${f.label}`); setOpen(false); }}
                disabled={cannotAfford}
                title={cannotAfford ? `Not enough $NXT (need ${f.cost})` : f.hint}
                style={{
                  display: 'block', width: '100%', padding: '6px 8px', border: 'none',
                  borderTop: i === 0 ? 'none' : '2px solid #3a4654',
                  background: 'transparent',
                  color: cannotAfford ? '#555' : '#1a2030',
                  cursor: cannotAfford ? 'default' : 'pointer',
                  fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
                  textAlign: 'left',
                }}
              >
                {f.emoji} {f.label} — {f.cost} $NXT (+{f.energy}E)
              </button>
            );
          })}
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
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
            textAlign: 'left',
          }}>{'\uD83D\uDDA5\uFE0F'} MAINFRAME — 15 $NXT</button>
          <button onClick={(e) => { onHackPlayer(e); setOpen(false); }} style={{
            display: 'block', width: '100%', padding: '6px 8px', border: 'none',
            borderTop: '2px solid #3a4654',
            background: 'transparent', color: '#1a2030', cursor: 'pointer',
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
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
          <span style={{ fontSize: 'var(--text-xl)', letterSpacing: 2, color: ok ? '#44ffaa' : '#ff4444' }}>
            {ok ? '> ACCESS GRANTED' : '> ACCESS DENIED'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', color: '#cfcfcf',
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)', cursor: 'pointer', padding: '2px 8px',
          }}>X</button>
        </div>
        {/* Body */}
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 8 }}>
            {isPlayer ? '\uD83D\uDC64 PLAYER HACK' : '\uD83D\uDDA5\uFE0F MAINFRAME HACK'}
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: '#cfcfcf', marginBottom: 16 }}>
            TARGET: {result.target_name}
            {result.target_corp && ` [${result.target_corp}]`}
            {result.target_owner && (
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
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
          <div style={{ fontSize: 'var(--text-base)', color: '#ccc', lineHeight: 1.8, marginBottom: 12 }}>
            <div style={{ color: '#ff6666' }}>Cost: -{result.cost} $NXT</div>
            {ok && (
              <>
                <div style={{ color: '#44ffaa' }}>Extracted: +{result.stolen} $NXT</div>
                <div style={{ color: '#44ccff' }}>Social: +{isPlayer ? 8 : 5}</div>
              </>
            )}
            <div style={{
              color: result.net_gain >= 0 ? '#ffdd44' : '#ff4444',
              fontWeight: 'bold', marginTop: 8, fontSize: 'var(--text-lg)',
            }}>
              NET: {result.net_gain >= 0 ? '+' : ''}{result.net_gain} $NXT
            </div>
          </div>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic',
            borderTop: '1px solid #333', paddingTop: 10,
          }}>
            {result.message}
          </div>
          {!ok && isPlayer && (
            <div style={{ color: '#ff9800', fontSize: 'var(--text-sm)', marginTop: 8 }}>
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
  no_targets:         { icon: '🔍', title: '> NO TARGETS',         color: '#cfcfcf' },
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
          <span style={{ fontSize: 'var(--text-xl)', letterSpacing: 2, color: c.color }}>
            {c.title}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', color: '#cfcfcf',
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)', cursor: 'pointer', padding: '2px 8px',
          }}>X</button>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
          <div style={{ color: c.color, fontSize: 'var(--text-lg)', marginBottom: 16 }}>
            {error.message}
          </div>
          {error.error === 'cooldown' && (
            <div style={{ color: '#ffdd44', fontSize: 22, marginBottom: 8 }}>
              {error.remaining_hours}h {error.remaining_minutes}m
            </div>
          )}
          {error.error === 'insufficient_funds' && (
            <div style={{ color: '#cfcfcf', fontSize: 'var(--text-base)' }}>
              Required: {error.required} $NXT | Available: {error.current} $NXT
            </div>
          )}
          {error.error === 'low_social' && (
            <div style={{ color: '#cfcfcf', fontSize: 'var(--text-base)' }}>
              Required: {error.required} Social | Current: {error.current}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)', fontWeight: 'bold',
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
  const isIdle = !!dev.is_idle;
  const loc = dev.location ? dev.location.replace(/_/g, ' ') : null;
  const [actionMsg, setActionMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
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
      }}
    >
      <div style={{
        filter: ((onMission && !missionCompleted) || isIdle) ? 'grayscale(100%)' : 'none',
        opacity: ((onMission && !missionCompleted) || isIdle) ? 0.7 : 1,
      }}>
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
              fontSize: 'var(--text-sm)', fontFamily: "'VT323', monospace", color: 'var(--terminal-amber, #ffaa00)',
            }}>
              [!] Profile loading from chain...
              <button className="win-btn"
                onClick={(e) => { e.stopPropagation(); onRetry?.(dev.token_id); }}
                style={{ fontSize: 'var(--text-sm)', padding: '0 4px', marginLeft: 'auto' }}>Retry</button>
            </div>
          )}
          {/* Name + Archetype + Rarity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', fontFamily: "'VT323', monospace" }}>{dev.name}</span>
            <span style={{ color: arcColor, fontSize: 'var(--text-base)', fontFamily: "'VT323', monospace" }}>[{dev.archetype}]</span>
            {dev.rarity_tier && dev.rarity_tier !== 'common' && (
              <span style={{
                fontSize: 'var(--text-xs)', padding: '0 3px', textTransform: 'uppercase',
                color: 'var(--gold-on-grey, #7a5c00)',
                border: '1px solid var(--gold-on-grey, #7a5c00)', borderRadius: '2px',
                fontFamily: "'VT323', monospace",
              }}>{dev.rarity_tier}</span>
            )}
          </div>
          {/* Corp | Species | Location | #Token */}
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary, #666)', display: 'flex', gap: '6px', flexWrap: 'wrap', fontFamily: "'VT323', monospace", lineHeight: 1.3 }}>
            {dev.corporation && <span>{dev.corporation.replace(/_/g, ' ')}</span>}
            {dev.species && <span>| {dev.species}</span>}
            {loc && <span>| {loc}</span>}
            <span>| #{dev.token_id}</span>
          </div>
          {/* Status line */}
          <div style={{ display: 'flex', gap: '6px', fontSize: 'var(--text-base)', alignItems: 'center', flexWrap: 'wrap', fontFamily: "'VT323', monospace" }}>
            <span style={{ color: 'var(--gold-on-grey, #7a5c00)' }}>
              {formatNumber(dev.balance_nxt)} $NXT
            </span>
            <span style={{ color: 'var(--text-muted, #888)' }}>{dev.mood || '-'}</span>
            {isIdle ? (
              <span style={{
                color: '#6a8aaa',
                textTransform: 'uppercase', fontWeight: 'bold',
              }}>💤 IDLE</span>
            ) : (
              <span style={{
                color: dev.status === 'active' ? 'var(--green-on-grey, #005500)' : dev.status === 'on_mission' ? '#2d8a2d' : dev.status === 'resting' ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)',
                textTransform: 'uppercase', fontWeight: 'bold',
              }}>{dev.status || 'active'}</span>
            )}
          </div>
          {/* VIEW full image button — opens the in-app DevImageModal with
              PFP / FULL BODY toggle + downloads. Click stops propagation
              so the DevCard's own onClick (which opens DevProfile)
              doesn't also fire. */}
          {dev.ipfs_hash && (
            <div style={{ marginTop: '2px' }}>
              <button
                className="win-btn"
                onClick={(e) => { e.stopPropagation(); setShowImageModal(true); }}
                style={{ fontSize: 'var(--text-xs)', padding: '1px 6px' }}
                title="View & download full image"
              >
                {'\uD83D\uDDBC\uFE0F'} VIEW
              </button>
            </div>
          )}
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
          fontSize: 'var(--text-base)', color: '#b8860b', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontFamily: "'VT323', monospace",
        }}>
          [TRAIN] {SHOP_ITEMS_MAP[dev.training_course] || dev.training_course}
          {dev.training_ends_at && new Date(dev.training_ends_at) <= new Date() ? (
            <StoneBtn emoji={'\uD83C\uDF93'} label="GRAD"
              onClick={doGraduate} disabled={busy}
              title="Complete training and apply stat bonus" />
          ) : dev.training_ends_at ? (
            <span style={{ color: 'var(--text-secondary)' }}> ({Math.max(0, Math.ceil((new Date(dev.training_ends_at) - new Date()) / 3600000))}h left)</span>
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
          <FeedDropdown dev={dev} busy={busy} onBuy={doShopAction} />
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
            onTransfer={(e) => { e.stopPropagation(); setShowTransferModal(true); }}
            onRequest={(e) => { e.stopPropagation(); setShowRequestModal(true); }} />
        </div>
      )}

      {/* Action feedback */}
      {actionMsg && (
        <div style={{ fontSize: 'var(--text-xs)', color: actionMsg.color, fontWeight: 'bold', marginBottom: '2px',
          fontFamily: "'VT323', monospace" }}>
          {actionMsg.text}
        </div>
      )}

      {/* Row 5: Footer counters + prompt */}
      <div style={{
        display: 'flex', gap: '8px', fontSize: 'var(--text-sm)',
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
      {showImageModal && (
        <DevImageModal dev={dev} onClose={() => setShowImageModal(false)} />
      )}
      {showTransferModal && (
        <TransferModal dev={dev} allDevs={allDevs} address={address} onClose={() => setShowTransferModal(false)} onDevUpdate={onDevUpdate} />
      )}
      {showRequestModal && (
        <TransferModal dev={dev} allDevs={allDevs} address={address} mode="request" onClose={() => setShowRequestModal(false)} onDevUpdate={onDevUpdate} />
      )}
      </div>{/* end grayscale wrapper */}

      {/* On Mission overlay — outside grayscale so colors are preserved */}
      {onMission && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '6px', zIndex: 2,
        }} onClick={e => e.stopPropagation()}>
          <span style={{
            fontSize: 'var(--text-lg)', fontWeight: 'bold', color: '#2d8a2d',
            textTransform: 'uppercase', letterSpacing: '2px',
            textShadow: '0 0 6px rgba(45, 138, 45, 0.5)',
            animation: 'mission-pulse 2s ease-in-out infinite',
          }}>⏳ ON MISSION</span>
          {mission && (
            <>
              <span style={{ fontSize: 'var(--text-sm)', color: '#ccc', maxWidth: '80%', textAlign: 'center' }}>
                {mission.title}
              </span>
              <span style={{
                fontSize: 'var(--text-sm)', fontWeight: 'bold',
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
                fontSize: 'var(--text-base)', padding: '6px 16px', fontWeight: 'bold',
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

// Icon/colour mapping keyed on the nx.actions action_type enum. The
// Activity tab reads /api/players/{wallet}/activity (see api.js) which
// exposes the full log, not the previous 5-type notifications slice.
// Unlisted types fall back to [?] + terminal-green.
const ACTION_ICONS = {
  CREATE_PROTOCOL: '[P]',
  CREATE_AI:       '[AI]',
  INVEST:          '[$$]',
  SELL:            '[$$]',
  CODE_REVIEW:     '[CR]',
  MOVE:            '[>>]',
  CHAT:            '[..]',
  REST:            '[ZZ]',
  RECEIVE_SALARY:  '[$]',
  USE_ITEM:        '[U]',
  GET_SABOTAGED:   '[X]',
  DEPLOY:          '[D]',
  FUND_DEV:        '[+$]',
  TRANSFER:        '[->]',
  HACK_MAINFRAME:  '[!]',
};

// Kept deliberately high-contrast on both the dark terminal background
// and the classic Win98 gray. Amber (#ffaa00) read as dim orange on
// black and was reported as hard to read, so code_review uses green.
const ACTION_COLORS = {
  CREATE_PROTOCOL: 'var(--terminal-green, #33ff33)',
  CREATE_AI:       'var(--terminal-cyan, #00ffff)',
  INVEST:          'var(--terminal-green, #33ff33)',
  SELL:            'var(--terminal-green, #33ff33)',
  CODE_REVIEW:     'var(--terminal-green, #33ff33)',
  MOVE:            'var(--terminal-cyan, #00ffff)',
  CHAT:            'var(--terminal-amber, #ffaa00)',
  REST:            'var(--text-muted, #888)',
  RECEIVE_SALARY:  'var(--gold, #ffd700)',
  USE_ITEM:        'var(--terminal-cyan, #00ffff)',
  GET_SABOTAGED:   'var(--terminal-red, #ff4444)',
  DEPLOY:          'var(--terminal-green, #33ff33)',
  FUND_DEV:        'var(--gold, #ffd700)',
  TRANSFER:        'var(--terminal-cyan, #00ffff)',
  HACK_MAINFRAME:  'var(--terminal-red, #ff4444)',
};

// Build a short human-readable summary from an action row. Details is
// a JSONB blob whose shape varies by action_type; we pull the most
// useful fields when we recognise the type and fall back to a compact
// key/value list otherwise. Values are clamped so nothing overflows.
function summarizeActionDetails(actionType, details) {
  const d = details || {};
  switch (actionType) {
    case 'CREATE_PROTOCOL':
      return d.protocol_name || d.name || 'new protocol';
    case 'CREATE_AI':
      return d.ai_name || d.name || 'new AI';
    case 'INVEST':
      return d.target
        ? `invested ${d.amount ?? '?'} in ${d.target}`
        : `invested ${d.amount ?? '?'}`;
    case 'SELL':
      return `sold${d.target ? ' ' + d.target : ''}${d.amount != null ? ` for ${d.amount}` : ''}`;
    case 'MOVE':
      return d.to ? `moved to ${d.to}` : (d.location || 'moved');
    case 'CHAT':
      return typeof d.message === 'string' ? d.message.slice(0, 140) : 'chat';
    case 'CODE_REVIEW':
      return d.target ? `reviewed ${d.target}` : 'code review';
    case 'REST':
      return d.energy_restored ? `rested (+${d.energy_restored} energy)` : 'resting';
    case 'RECEIVE_SALARY':
      return d.amount ? `salary +${d.amount} $NXT` : 'salary';
    case 'FUND_DEV':
      return d.amount ? `funded +${d.amount} $NXT` : 'funded';
    case 'TRANSFER':
      return d.amount != null
        ? `transfer ${d.amount} $NXT${d.to_dev_name ? ' → ' + d.to_dev_name : ''}`
        : 'transfer';
    default: {
      // Generic fallback: first string / number value, capped.
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'string' && v.length < 160) return `${k}: ${v}`;
        if (typeof v === 'number') return `${k}: ${v}`;
      }
      return '';
    }
  }
}

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
      api.getWalletActivity(walletAddress, { limit: 200 })
        .then(res => {
          setActivities(Array.isArray(res?.activity) ? res.activity : []);
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

  // Build dev name map (for the rare case `a.dev_name` is missing).
  const devNameMap = {};
  (devs || []).forEach(d => { devNameMap[d.token_id] = d.name; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: 'var(--text-sm)',
      }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-muted, #888)' }}>Filter:</span>
        <select
          value={filterDev}
          onChange={(e) => setFilterDev(e.target.value)}
          style={{
            fontSize: 'var(--text-sm)', padding: '2px 4px',
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
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
            color: 'var(--terminal-amber)',
          }}>
            {'>'} No dev actions recorded yet.
          </div>
        ) : (
          <div className="terminal" style={{ padding: '4px 8px' }}>
            {filtered.map((a, i) => {
              const icon = ACTION_ICONS[a.action_type] || '[?]';
              const color = ACTION_COLORS[a.action_type] || 'var(--terminal-green, #33ff33)';
              const devName = a.dev_name || devNameMap[a.dev_id] || (a.dev_id ? `Dev #${a.dev_id}` : '');
              const summary = summarizeActionDetails(a.action_type, a.details);
              return (
                <div key={a.id || i} style={{
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  lineHeight: 1.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color, fontWeight: 'bold', fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)', flexShrink: 0 }}>
                      {icon}
                    </span>
                    <span style={{ fontWeight: 'bold', color, fontSize: 'var(--text-base)', fontFamily: "'VT323', monospace" }}>
                      {a.action_type}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', flexShrink: 0, fontFamily: "'VT323', monospace" }}>
                      {formatActivityTime(a.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)', color: '#cfcfcf',
                    marginTop: '2px', paddingLeft: '30px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: "'VT323', monospace",
                  }}>
                    {devName && (
                      <span style={{ color: 'var(--terminal-cyan, #00ffff)', fontWeight: 'bold' }}>
                        {devName}:{' '}
                      </span>
                    )}
                    {summary}
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

  // Fetch activity count for the tab badge. nx.actions has no read/unread
  // concept, so we just surface the recent-activity size (capped by the
  // endpoint's LIMIT) — clamped at 99 so the label stays tight.
  useEffect(() => {
    if (!address) return;
    api.getWalletActivity(address, { limit: 100 })
      .then(res => {
        const n = Array.isArray(res?.activity) ? res.activity.length : 0;
        setActivityCount(Math.min(n, 99));
      })
      .catch(() => {});
  }, [address]);

  const isLoadingAny = loading;

  const headerStyle = {
    padding: '6px 8px',
    background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
    fontSize: 'var(--text-base)',
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
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            Connect wallet to see your devs
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
            Your developers will appear here once your wallet is connected.
          </div>
          {/* connect = openSelector via useWallet(). */}
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
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            No devs yet
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
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
            style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', marginLeft: '6px', cursor: 'pointer' }}
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
          fontSize: 'var(--text-base)',
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
                padding: '2px 8px', fontSize: 'var(--text-sm)', fontFamily: "'VT323', monospace",
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
