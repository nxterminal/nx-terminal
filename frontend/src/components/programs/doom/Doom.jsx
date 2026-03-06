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
  '> Executing DOOM.EXE...',
];

const JSDOS_URL = 'https://js-dos.com/games/doom.exe.html';

// ── States: connect | denied | loading | playing | error ──
export default function Doom({ openWindow, onClose }) {
  const { address, isConnected, connect } = useWallet();
  const [phase, setPhase] = useState('init'); // init → connect | denied | loading | playing | error
  const [loadingLine, setLoadingLine] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef(null);

  // NFT balance check
  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  const hasNFT = balance !== undefined && Number(balance) > 0;

  // Determine phase based on wallet/NFT state
  useEffect(() => {
    if (!isConnected) {
      setPhase('connect');
      return;
    }
    if (balanceLoading) {
      setPhase('init');
      return;
    }
    if (balanceError) {
      setPhase('error');
      return;
    }
    if (balance !== undefined) {
      setPhase(hasNFT ? 'loading' : 'denied');
    }
  }, [isConnected, balance, balanceLoading, balanceError, hasNFT]);

  // Loading animation
  useEffect(() => {
    if (phase !== 'loading') return;
    setLoadingLine(0);
    setLoadingProgress(0);

    const lineInterval = setInterval(() => {
      setLoadingLine(prev => {
        if (prev >= LOADING_LINES.length - 1) {
          clearInterval(lineInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 3 + Math.floor(Math.random() * 5);
      });
    }, 150);

    return () => {
      clearInterval(lineInterval);
      clearInterval(progressInterval);
    };
  }, [phase]);

  // Transition to playing when loading complete
  useEffect(() => {
    if (phase === 'loading' && loadingProgress >= 100) {
      const timer = setTimeout(() => setPhase('playing'), 600);
      return () => clearTimeout(timer);
    }
  }, [phase, loadingProgress]);

  const focusIframe = useCallback(() => {
    try { iframeRef.current?.contentWindow?.focus(); } catch {}
    iframeRef.current?.focus();
  }, []);

  const handleIframeError = () => {
    setIframeError(true);
  };

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
            <button className="win-btn" onClick={connect}>CONNECT</button>
            <button className="win-btn" onClick={onClose}>CANCEL</button>
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
            <button className="win-btn" onClick={onClose}>CLOSE</button>
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
                ? 'DOSBox emulation failed to load. CDN may be unavailable.'
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
              setPhase(hasNFT ? 'loading' : 'init');
            }}>RETRY</button>
            <button className="win-btn" onClick={onClose}>CLOSE</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading Screen ──
  if (phase === 'loading' || phase === 'init') {
    const clampedProgress = Math.min(loadingProgress, 100);
    const barFilled = Math.round(clampedProgress / 4);
    const barEmpty = 25 - barFilled;
    const progressBar = '\u2588'.repeat(barFilled) + '\u2591'.repeat(barEmpty);

    return (
      <div className="doom-loading">
        <div className="doom-loading-text">
          {LOADING_LINES.slice(0, loadingLine + 1).map((line, i) => (
            <div key={i} className="doom-loading-line">
              {line}
              {i === loadingLine && <span className="doom-cursor">_</span>}
            </div>
          ))}
        </div>
        <div className="doom-progress">
          {progressBar} {clampedProgress}%
        </div>
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
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-popups"
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
