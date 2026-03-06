import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from '../../../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI } from '../../../services/contract';
import './Doom.css';

const LOADING_LINES = [
  '> LOADING DOOM.exe...',
  '> Verifying Dev clearance... OK',
  '> Initializing DOSBox emulation...',
  '> Loading WAD files...',
  '> Mounting C:\\DOOM\\...',
  '> Configuring keyboard-only input...',
  '> Executing DOOM.EXE...',
];

// Self-hosted js-dos player (no external CDN, no branding)
const JSDOS_URL = '/doom/index.html';

// ── States: intro → connect | denied | loading | playing | error ──
export default function Doom({ openWindow, onClose }) {
  const { address, isConnected, connect } = useWallet();
  const [phase, setPhase] = useState('intro');
  const [loadingLine, setLoadingLine] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef(null);

  // NFT balance check — only enabled after user clicks LAUNCH
  const [checkNFT, setCheckNFT] = useState(false);
  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: checkNFT && !!address && isConnected },
  });

  const hasNFT = balance !== undefined && Number(balance) > 0;

  // Handle LAUNCH button
  const handleLaunch = useCallback(() => {
    if (!isConnected) {
      setPhase('connect');
      return;
    }
    setCheckNFT(true);
    setPhase('checking');
  }, [isConnected]);

  // React to NFT check results
  useEffect(() => {
    if (phase !== 'checking') return;
    if (balanceLoading) return;
    if (balanceError) { setPhase('error'); return; }
    if (balance !== undefined) {
      setPhase(hasNFT ? 'loading' : 'denied');
    }
  }, [phase, balance, balanceLoading, balanceError, hasNFT]);

  // Loading animation
  useEffect(() => {
    if (phase !== 'loading') return;
    setLoadingLine(0);
    setLoadingProgress(0);

    const lineInterval = setInterval(() => {
      setLoadingLine(prev => {
        if (prev >= LOADING_LINES.length - 1) { clearInterval(lineInterval); return prev; }
        return prev + 1;
      });
    }, 500);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) { clearInterval(progressInterval); return 100; }
        return prev + 3 + Math.floor(Math.random() * 5);
      });
    }, 150);

    return () => { clearInterval(lineInterval); clearInterval(progressInterval); };
  }, [phase]);

  // Transition to playing when loading complete
  useEffect(() => {
    if (phase === 'loading' && loadingProgress >= 100) {
      const timer = setTimeout(() => setPhase('playing'), 600);
      return () => clearTimeout(timer);
    }
  }, [phase, loadingProgress]);

  // ── Heartbeat: prevent screensaver while playing ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const heartbeat = setInterval(() => {
      window.dispatchEvent(new Event('mousemove'));
    }, 10000);
    return () => clearInterval(heartbeat);
  }, [phase]);

  const focusIframe = useCallback(() => {
    try { iframeRef.current?.contentWindow?.focus(); } catch {}
    iframeRef.current?.focus();
  }, []);

  // ── INTRO SCREEN (Win98 dialog style) ──
  if (phase === 'intro') {
    return (
      <div className="doom-intro">
        {/* Icon + Title area */}
        <div className="doom-intro-top">
          <div className="doom-intro-icon-area">
            <div className="doom-intro-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="2" width="28" height="28" rx="2" fill="#8B0000"/>
                <text x="16" y="22" textAnchor="middle" fill="#ff4400" fontFamily="'VT323', monospace" fontSize="18" fontWeight="bold">DM</text>
              </svg>
            </div>
          </div>
          <div className="doom-intro-title-area">
            <div className="doom-intro-title">DOOM.exe — Recreational Software</div>
            <div className="doom-intro-subtitle">NX Terminal Entertainment Division</div>
          </div>
        </div>

        {/* Divider */}
        <div className="doom-intro-divider" />

        {/* Message panel */}
        <div className="doom-intro-panel">
          <div className="doom-intro-panel-inner">
            <p className="doom-intro-lore">
              <strong>ATTENTION — Dev Break Protocol</strong>
            </p>
            <p>
              The NX Terminal recognizes that developers require periodic cognitive
              decompression. This classified recreational module has been provisioned
              for registered Devs who need to blow off some steam.
            </p>
            <p>
              DOOM (Shareware v1.9 — Episode 1: Knee-Deep in the Dead) is available
              as an authorized break activity for your team.
            </p>
            <p className="doom-intro-req">
              <strong>Requirements:</strong>
            </p>
            <ul className="doom-intro-list">
              <li>You must have at least <strong>1 NX Dev NFT</strong> minted</li>
              <li>Use <strong>Mint/Hire Devs</strong> on your desktop to register a Dev</li>
              <li>Keyboard controls only — mouse input is disabled</li>
            </ul>
          </div>
        </div>

        {/* Security classification bar */}
        <div className="doom-intro-clearance">
          Security Clearance: <strong>DEV ACCESS REQUIRED</strong>
        </div>

        {/* Bottom buttons */}
        <div className="doom-intro-buttons">
          <button className="win-btn doom-launch-btn" onClick={handleLaunch}>Launch DOOM</button>
          <button className="win-btn" onClick={() => openWindow('hire-devs')}>Mint a Dev</button>
          <button className="win-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // ── Connect Wallet Dialog ──
  if (phase === 'connect') {
    return (
      <div className="doom-dialog-overlay">
        <div className="doom-dialog">
          <div className="doom-dialog-title">
            <span className="doom-dialog-icon">&#9888;</span>
            DOOM.exe - Authentication Required
          </div>
          <div className="doom-dialog-body">
            <p className="doom-dialog-error">
              <strong>[!] ERROR:</strong> No wallet connection detected
            </p>
            <p>Connect your wallet to verify Dev NFT clearance.</p>
            <p className="doom-dialog-meta">
              Security Level: CLASSIFIED<br />
              Status: NO_WALLET
            </p>
          </div>
          <div className="doom-dialog-buttons">
            <button className="win-btn" onClick={() => { connect(); setPhase('intro'); }}>CONNECT</button>
            <button className="win-btn" onClick={() => setPhase('intro')}>BACK</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Access Denied Dialog ──
  if (phase === 'denied') {
    return (
      <div className="doom-dialog-overlay">
        <div className="doom-dialog">
          <div className="doom-dialog-title">
            <span className="doom-dialog-icon">&#9888;</span>
            DOOM.exe - Access Denied
          </div>
          <div className="doom-dialog-body">
            <p className="doom-dialog-error">
              <strong>[X] ERROR:</strong> Dev clearance required
            </p>
            <p>You need to mint at least one NX Dev NFT to access DOOM.exe</p>
            <p className="doom-dialog-meta">
              Security Level: CLASSIFIED<br />
              Status: UNAUTHORIZED
            </p>
          </div>
          <div className="doom-dialog-buttons">
            <button className="win-btn" onClick={() => openWindow('hire-devs')}>MINT NOW</button>
            <button className="win-btn" onClick={() => setPhase('intro')}>BACK</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error Dialog ──
  if (phase === 'error' || iframeError) {
    return (
      <div className="doom-dialog-overlay">
        <div className="doom-dialog">
          <div className="doom-dialog-title">
            <span className="doom-dialog-icon" style={{ color: '#ff0000' }}>&#10006;</span>
            DOOM.exe - Fatal Error
          </div>
          <div className="doom-dialog-body">
            <p className="doom-dialog-error">
              <strong>[!] FATAL:</strong> {iframeError
                ? 'DOSBox emulation failed to load.'
                : 'Could not verify NFT balance. Network error.'}
            </p>
            <p className="doom-dialog-meta">
              Error Code: 0xDEAD{iframeError ? 'C0DE' : 'BEEF'}<br />
              Status: SYSTEM_FAILURE
            </p>
          </div>
          <div className="doom-dialog-buttons">
            <button className="win-btn" onClick={() => {
              setIframeError(false);
              setPhase(hasNFT ? 'loading' : 'intro');
            }}>RETRY</button>
            <button className="win-btn" onClick={onClose}>CLOSE</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Checking / Loading Screen ──
  if (phase === 'loading' || phase === 'checking') {
    const clampedProgress = Math.min(loadingProgress, 100);
    const barFilled = Math.round(clampedProgress / 4);
    const barEmpty = 25 - barFilled;
    const progressBar = '\u2588'.repeat(barFilled) + '\u2591'.repeat(barEmpty);

    return (
      <div className="doom-loading">
        <div className="doom-loading-text">
          {phase === 'checking' ? (
            <div className="doom-loading-line">{"> Verifying Dev clearance..."}<span className="doom-cursor">_</span></div>
          ) : (
            LOADING_LINES.slice(0, loadingLine + 1).map((line, i) => (
              <div key={i} className="doom-loading-line">
                {line}
                {i === loadingLine && <span className="doom-cursor">_</span>}
              </div>
            ))
          )}
        </div>
        {phase === 'loading' && (
          <div className="doom-progress">
            {progressBar} {clampedProgress}%
          </div>
        )}
        <div className="doom-classified">
          {'\u26A0'} CLASSIFIED RECREATIONAL SOFTWARE<br />
          Authorized personnel only
        </div>
      </div>
    );
  }

  // ── Playing ──
  return (
    <div className="doom-container" onClick={focusIframe}>
      <iframe
        ref={iframeRef}
        src={JSDOS_URL}
        className="doom-iframe"
        allowFullScreen
        title="DOOM.exe"
        onError={() => setIframeError(true)}
      />
      <div className="doom-controls-bar">
        <span>[Arrows: Move]</span>
        <span>[Ctrl: Fire]</span>
        <span>[Space: Use]</span>
        <span>[Enter: Menu]</span>
        <button
          className="win-btn doom-fullscreen-btn"
          onClick={(e) => {
            e.stopPropagation();
            iframeRef.current?.requestFullscreen?.();
          }}
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
}
