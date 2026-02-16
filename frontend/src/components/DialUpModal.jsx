import { useState, useEffect, useRef, useCallback } from 'react';

/* ───────────────────────────────────────────────────────
   Phase 1 — "Dialing Progress"  (~5 s)
   Phase 2 — "Downloading"       (~8 s)
   Phase 3 — "Download Complete" (wait for click)
   ─────────────────────────────────────────────────────── */

const DIAL_STEPS = [
  { text: 'Dialing NX Terminal Network...', dur: 1600 },
  { text: 'Verifying identity...', dur: 1400 },
  { text: 'Handshaking...', dur: 1200 },
  { text: 'Connected at 56.6 Kbps', dur: 800 },
];

const DL_TOTAL = 8000;

/* ─── pixel-art SVG icons (inline, no external assets) ─── */

function GlobeSVG() {
  return (
    <svg className="dialup-globe" width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" fill="#008080" stroke="#000" strokeWidth="1" />
      <ellipse cx="20" cy="20" rx="8" ry="18" fill="none" stroke="#004040" strokeWidth="1" />
      <line x1="2" y1="14" x2="38" y2="14" stroke="#004040" strokeWidth="1" />
      <line x1="2" y1="26" x2="38" y2="26" stroke="#004040" strokeWidth="1" />
      <line x1="20" y1="2" x2="20" y2="38" stroke="#004040" strokeWidth="1" />
      {/* highlight */}
      <path d="M12 6 Q20 4 28 6" stroke="#33cccc" strokeWidth="1" fill="none" />
    </svg>
  );
}

function PhoneSVG() {
  return (
    <svg className="dialup-phone" width="32" height="40" viewBox="0 0 32 40" fill="none">
      {/* body */}
      <rect x="6" y="8" width="20" height="24" rx="2" fill="#e8c800" stroke="#000" strokeWidth="1" />
      {/* earpiece */}
      <rect x="10" y="4" width="12" height="6" rx="2" fill="#d4b400" stroke="#000" strokeWidth="1" />
      {/* mouthpiece */}
      <rect x="10" y="30" width="12" height="6" rx="2" fill="#d4b400" stroke="#000" strokeWidth="1" />
      {/* dial pad dots */}
      {[0,1,2].map(r => [0,1,2].map(c => (
        <rect key={`${r}${c}`} x={11 + c * 4} y={14 + r * 5} width="2" height="2" fill="#000" />
      )))}
      {/* cord */}
      <path d="M16 36 Q16 42 12 44" stroke="#555" strokeWidth="1" fill="none" />
    </svg>
  );
}

function ComputerSVG() {
  return (
    <svg width="44" height="40" viewBox="0 0 44 40" fill="none">
      {/* monitor */}
      <rect x="4" y="2" width="36" height="26" rx="1" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
      {/* screen */}
      <rect x="7" y="5" width="30" height="18" fill="#000080" stroke="#808080" strokeWidth="1" />
      {/* screen text lines */}
      <rect x="10" y="9" width="16" height="2" fill="#00ff00" />
      <rect x="10" y="13" width="22" height="2" fill="#00ff00" />
      <rect x="10" y="17" width="12" height="2" fill="#00ff00" opacity="0.7" />
      {/* stand */}
      <rect x="16" y="28" width="12" height="3" fill="#a0a0a0" stroke="#808080" strokeWidth="1" />
      {/* base */}
      <rect x="10" y="31" width="24" height="3" rx="1" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />
      {/* power led */}
      <circle cx="38" cy="25" r="1.5" fill="#00ff00" />
    </svg>
  );
}

function FolderSVG({ open }) {
  return (
    <svg width="36" height="32" viewBox="0 0 36 32" fill="none">
      {open ? (
        <>
          {/* open folder */}
          <path d="M2 10 L2 28 L30 28 L34 10 Z" fill="#ffcc00" stroke="#000" strokeWidth="1" />
          <path d="M2 10 L14 10 L16 6 L2 6 Z" fill="#ffdd44" stroke="#000" strokeWidth="1" />
          <path d="M2 10 L8 10 L30 10 L34 10 L30 28 L2 28 Z" fill="#ffcc00" stroke="#000" strokeWidth="1" />
        </>
      ) : (
        <>
          {/* closed folder */}
          <rect x="2" y="10" width="32" height="20" rx="1" fill="#ffcc00" stroke="#000" strokeWidth="1" />
          <path d="M2 10 L14 10 L16 6 L2 6 Z" fill="#ffdd44" stroke="#000" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function FlyingFileSVG() {
  return (
    <svg className="dialup-flying-file" width="20" height="24" viewBox="0 0 20 24" fill="none">
      <path d="M1 1 L13 1 L17 5 L17 23 L1 23 Z" fill="white" stroke="#000" strokeWidth="1" />
      <path d="M13 1 L13 5 L17 5" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
      <rect x="4" y="8" width="10" height="1.5" fill="#000080" />
      <rect x="4" y="11" width="8" height="1.5" fill="#000080" />
      <rect x="4" y="14" width="10" height="1.5" fill="#000080" />
      <rect x="4" y="17" width="6" height="1.5" fill="#000080" />
    </svg>
  );
}

/* ─── lightning bolts between icons ─── */
function LightningBolt() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" className="dialup-bolt">
      <path d="M2 8 L8 2 L7 7 L12 7 L5 15 L7 9 L2 8Z" fill="#ffcc00" stroke="#cc9900" strokeWidth="0.5" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════ */

export default function DialUpModal({ devCount, corp, onComplete, onCancel }) {
  const [phase, setPhase] = useState(1);
  const [dialIdx, setDialIdx] = useState(0);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlFileName, setDlFileName] = useState('employee_credential.nft');
  const [dlFrom, setDlFrom] = useState('blockchain.nx-terminal.corp');
  const [dlTimeLeft, setDlTimeLeft] = useState('39 years');
  const [dlSpeed, setDlSpeed] = useState('4.61 KB/Sec');
  const cancelled = useRef(false);
  const intervalRef = useRef(null);

  /* ── Phase 1: Dialing ── */
  useEffect(() => {
    if (phase !== 1 || cancelled.current) return;

    let i = 0;

    const advance = () => {
      if (cancelled.current) return;
      if (i >= DIAL_STEPS.length) {
        setPhase(2);
        return;
      }
      setDialIdx(i);
      const dur = DIAL_STEPS[i].dur;
      i++;
      setTimeout(advance, dur);
    };

    advance();
  }, [phase]);

  /* ── Phase 2: Download ── */
  useEffect(() => {
    if (phase !== 2 || cancelled.current) return;

    const start = Date.now();
    intervalRef.current = setInterval(() => {
      if (cancelled.current) { clearInterval(intervalRef.current); return; }

      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / DL_TOTAL) * 100);
      setDlProgress(pct);

      // Fun transitions
      if (pct > 20) setDlSpeed('12.4 KB/Sec');
      if (pct > 45) {
        setDlTimeLeft('2 min 14 sec');
        setDlSpeed('28.8 KB/Sec');
      }
      if (pct > 65) {
        setDlFileName('employee_credential.nft');
        setDlFrom('node-07.megaeth.corp');
        setDlTimeLeft('47 seconds');
        setDlSpeed('42.0 KB/Sec');
      }
      if (pct > 85) {
        setDlTimeLeft('3 seconds');
        setDlSpeed('56.6 KB/Sec');
      }

      if (pct >= 100) {
        clearInterval(intervalRef.current);
        setTimeout(() => { if (!cancelled.current) setPhase(3); }, 400);
      }
    }, 50);

    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const handleCancel = useCallback(() => {
    cancelled.current = true;
    clearInterval(intervalRef.current);
    onCancel?.();
  }, [onCancel]);

  const handleOpen = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const handleOpenFolder = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  /* ── Render ── */
  return (
    <div className="dialup-overlay">
      {/* ════════ PHASE 1 — DIALING ════════ */}
      {phase === 1 && (
        <div className="dialup-win98">
          <div className="dialup-titlebar">
            <span className="dialup-titlebar-icon">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="#008080" stroke="#000" strokeWidth="1" />
                <ellipse cx="8" cy="8" rx="3" ry="6" fill="none" stroke="#004040" strokeWidth="0.5" />
                <line x1="2" y1="6" x2="14" y2="6" stroke="#004040" strokeWidth="0.5" />
                <line x1="2" y1="10" x2="14" y2="10" stroke="#004040" strokeWidth="0.5" />
              </svg>
            </span>
            <span className="dialup-titlebar-title">Dialing Progress</span>
            <button className="dialup-titlebar-btn" onClick={handleCancel}>
              <span>×</span>
            </button>
          </div>

          <div className="dialup-body">
            {/* Icon row: Globe ← ⚡ → Phone ← ⚡ → Computer */}
            <div className="dialup-icons-row">
              <div className="dialup-icon-cell">
                <GlobeSVG />
                <div className="dialup-icon-label">NX Network</div>
              </div>
              <div className="dialup-connector">
                <LightningBolt />
                <div className="dialup-wire" />
                <LightningBolt />
              </div>
              <div className="dialup-icon-cell">
                <PhoneSVG />
                <div className="dialup-icon-label">Modem</div>
              </div>
              <div className="dialup-connector">
                <LightningBolt />
                <div className="dialup-wire" />
                <LightningBolt />
              </div>
              <div className="dialup-icon-cell">
                <ComputerSVG />
                <div className="dialup-icon-label">Your PC</div>
              </div>
            </div>

            {/* Status text */}
            <div className="dialup-status-area">
              <div className="dialup-status-label">Action:</div>
              <div className="dialup-status-text">
                {DIAL_STEPS[dialIdx]?.text || 'Initializing...'}
              </div>
            </div>

            {/* Separator */}
            <div className="dialup-separator" />

            {/* Buttons */}
            <div className="dialup-btn-row">
              <button className="win-btn dialup-action-btn" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ PHASE 2 — DOWNLOADING ════════ */}
      {phase === 2 && (
        <div className="dialup-win98 dialup-dl">
          <div className="dialup-titlebar">
            <span className="dialup-titlebar-icon">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="1" y="4" width="14" height="10" rx="1" fill="#ffcc00" stroke="#000" strokeWidth="0.7" />
                <path d="M1 4 L6 4 L7 2 L1 2 Z" fill="#ffdd44" stroke="#000" strokeWidth="0.7" />
              </svg>
            </span>
            <span className="dialup-titlebar-title">
              Minting {devCount} Dev{devCount > 1 ? 's' : ''} — {corp || 'MegaETH'}
            </span>
            <button className="dialup-titlebar-btn" onClick={handleCancel}>
              <span>×</span>
            </button>
          </div>

          <div className="dialup-body dialup-dl-body">
            {/* Flying file animation */}
            <div className="dialup-copy-anim">
              <FolderSVG open={false} />
              <div className="dialup-file-track">
                <FlyingFileSVG />
              </div>
              <FolderSVG open={true} />
            </div>

            {/* File info */}
            <div className="dialup-dl-info">
              <div className="dialup-dl-row">
                <span className="dialup-dl-label">Saving:</span>
                <span className="dialup-dl-value">{dlFileName}</span>
              </div>
              <div className="dialup-dl-row">
                <span className="dialup-dl-label">from:</span>
                <span className="dialup-dl-value">{dlFrom}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="dialup-progress-wrap">
              <div className="dialup-progress-bar">
                {/* Individual blue blocks */}
                {Array.from({ length: Math.floor(dlProgress / 3.33) }, (_, i) => (
                  <div key={i} className="dialup-progress-block" />
                ))}
              </div>
            </div>

            {/* Transfer details */}
            <div className="dialup-dl-details">
              <div className="dialup-dl-row">
                <span className="dialup-dl-label">Estimated time left:</span>
                <span className="dialup-dl-value dialup-dl-time">{dlTimeLeft}</span>
              </div>
              <div className="dialup-dl-row">
                <span className="dialup-dl-label">Transfer rate:</span>
                <span className="dialup-dl-value">{dlSpeed}</span>
              </div>
            </div>

            {/* Separator */}
            <div className="dialup-separator" />

            <div className="dialup-btn-row">
              <button className="win-btn dialup-action-btn" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ PHASE 3 — COMPLETE ════════ */}
      {phase === 3 && (
        <div className="dialup-win98 dialup-complete">
          <div className="dialup-titlebar">
            <span className="dialup-titlebar-icon">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="7" fill="#fff" stroke="#000" strokeWidth="0.7" />
                <circle cx="8" cy="8" r="5" fill="#000080" />
                <text x="8" y="11" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">i</text>
              </svg>
            </span>
            <span className="dialup-titlebar-title">Download Complete</span>
            <button className="dialup-titlebar-btn" onClick={handleOpen}>
              <span>×</span>
            </button>
          </div>

          <div className="dialup-body dialup-complete-body">
            <div className="dialup-complete-row">
              {/* Big info icon */}
              <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
                <circle cx="16" cy="16" r="14" fill="#fff" stroke="#000080" strokeWidth="2" />
                <circle cx="16" cy="16" r="10" fill="#000080" />
                <text x="16" y="22" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold" fontFamily="serif">i</text>
              </svg>
              <div className="dialup-complete-text">
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Download complete</div>
                <div>
                  Successfully minted <strong>{devCount}</strong> dev{devCount > 1 ? 's' : ''} to{' '}
                  <strong>{corp || 'MegaETH Network'}</strong>.
                </div>
                <div style={{ marginTop: 4, color: '#808080' }}>
                  Your new employees are reporting for duty.
                </div>
              </div>
            </div>

            <div className="dialup-separator" />

            <div className="dialup-btn-row dialup-btn-row-end">
              <button className="win-btn dialup-action-btn dialup-btn-default" onClick={handleOpen}>
                Open
              </button>
              <button className="win-btn dialup-action-btn" onClick={handleOpenFolder}>
                Open Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
