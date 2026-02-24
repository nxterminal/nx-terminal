import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI } from '../services/contract';
import { api } from '../services/api';

// ── Post-mint deploy animation ──────────────────────────────
const DEPLOY_STEPS = [
  { text: 'Connecting to MegaETH mainnet...', duration: 800 },
  { text: 'Installing neural pathways...', duration: 800 },
  { text: 'Compiling personality matrix...', duration: 1200 },
  { text: 'Deploying to corporation...', duration: 1000 },
  { text: 'Developer deployed successfully!', duration: 0 },
];

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

const RETRO_KEYFRAMES = `
@keyframes nxFlyFile {
  0% { transform: translateX(0px) translateY(0px); opacity: 1; }
  50% { transform: translateX(30px) translateY(-8px); opacity: 0.7; }
  90% { transform: translateX(58px) translateY(0px); opacity: 0.4; }
  100% { transform: translateX(0px) translateY(0px); opacity: 1; }
}
@keyframes nxProgressStripe {
  0% { background-position: 0 0; }
  100% { background-position: 16px 0; }
}
`;

function MintAnimation({ quantity, txHash, address, openDevProfile, openWindow, onReset }) {
  const [phase, setPhase] = useState('dialup'); // dialup | copying | deploying | done
  const [dialStep, setDialStep] = useState(0);
  const [deployStep, setDeployStep] = useState(-1);
  const [copyProgress, setCopyProgress] = useState(0);
  const [mintedIds, setMintedIds] = useState([]);
  const [mintedDevs, setMintedDevs] = useState([]);
  const timerRef = useRef(null);
  const [transferSpeed] = useState(() => Math.round(14.4 + Math.random() * 42));

  // Fetch token IDs owned by this wallet
  const { data: ownedTokens } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (ownedTokens && ownedTokens.length > 0) {
      const ids = ownedTokens.slice(-quantity).map(id => Number(id));
      setMintedIds(ids);

      // Fetch full dev data for GIF display + dispatch events
      Promise.all(
        ids.map(tokenId =>
          api.getDev(tokenId).catch(() => ({
            token_id: tokenId,
            name: `Dev #${tokenId}`,
            corporation: 'UNKNOWN',
            archetype: 'UNKNOWN',
            species: 'Unknown',
          }))
        )
      ).then(devs => {
        setMintedDevs(devs);
        devs.forEach(dev => {
          window.dispatchEvent(new CustomEvent('nx-dev-hired', { detail: { dev } }));
        });
      });
    }
  }, [ownedTokens, quantity]);

  // ── Dial-up phase ──
  const DIAL_LINES = [
    'ATDT 555-0198-NXT',
    'Negotiating baud rate... 56000 bps',
    'Authenticating employee credentials...',
    'Verifying corporate loyalty score...',
    'Connection established!',
  ];

  useEffect(() => {
    if (phase !== 'dialup') return;
    if (dialStep >= DIAL_LINES.length) {
      timerRef.current = setTimeout(() => setPhase('copying'), 600);
      return;
    }
    timerRef.current = setTimeout(() => setDialStep(s => s + 1), 700);
    return () => clearTimeout(timerRef.current);
  }, [phase, dialStep]);

  // ── Copy phase (retro download) ──
  useEffect(() => {
    if (phase !== 'copying') return;
    if (copyProgress >= 100) {
      timerRef.current = setTimeout(() => {
        setPhase('deploying');
        setDeployStep(0);
      }, 600);
      return;
    }
    const increment = Math.random() * 8 + 2;
    timerRef.current = setTimeout(
      () => setCopyProgress(p => Math.min(100, p + increment)),
      200 + Math.random() * 300,
    );
    return () => clearTimeout(timerRef.current);
  }, [phase, copyProgress]);

  // ── Deploy phase ──
  useEffect(() => {
    if (phase !== 'deploying') return;
    if (deployStep < 0) return;
    if (deployStep >= DEPLOY_STEPS.length) {
      setPhase('done');
      return;
    }
    const step = DEPLOY_STEPS[deployStep];
    if (step.duration === 0) {
      timerRef.current = setTimeout(() => setPhase('done'), 800);
      return;
    }
    timerRef.current = setTimeout(() => setDeployStep(s => s + 1), step.duration);
    return () => clearTimeout(timerRef.current);
  }, [phase, deployStep]);

  // Cleanup
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const totalFileSize = 1024 * quantity;
  const copiedKB = Math.round((copyProgress / 100) * totalFileSize);
  const secsLeft = copyProgress < 100 ? Math.ceil((totalFileSize - copiedKB) / transferSpeed) : 0;
  const minsLeft = Math.floor(secsLeft / 60);
  const secsRem = secsLeft % 60;

  const dialogBg = {
    background: '#c0c0c0',
    border: '2px outset #dfdfdf',
    fontFamily: "'Tahoma', 'MS Sans Serif', Arial, sans-serif",
    fontSize: '11px',
    color: '#000',
  };

  const titleBar = {
    background: 'linear-gradient(90deg, #000080, #1084d0)',
    color: '#fff',
    padding: '3px 6px',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: "'Tahoma', 'MS Sans Serif', Arial, sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  // ── DIAL-UP ──
  if (phase === 'dialup') {
    return (
      <div style={dialogBg}>
        <style>{RETRO_KEYFRAMES}</style>
        <div style={titleBar}>
          <span style={{ fontSize: '10px' }}>[=]</span>
          Connecting to NX Terminal Corp.
        </div>
        <div style={{
          padding: '12px', background: '#0a0a0a', margin: '8px',
          border: '2px inset #808080',
          fontFamily: "'VT323', 'Courier New', monospace",
          fontSize: '13px', color: '#33ff33', lineHeight: 1.6,
          minHeight: '100px',
        }}>
          <div style={{ marginBottom: '6px', color: '#ffaa00', textAlign: 'center' }}>
            {'  '}[=PC=]---{'(('}{'\\u2706'}{'))'}---[NXT]
          </div>
          {DIAL_LINES.slice(0, dialStep).map((line, i) => (
            <div key={i}>{'>'} {line}</div>
          ))}
          <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
        </div>
      </div>
    );
  }

  // ── COPYING FILES — Retro Download Dialog ──
  if (phase === 'copying') {
    return (
      <div style={dialogBg}>
        <style>{RETRO_KEYFRAMES}</style>
        <div style={titleBar}>
          <span style={{ fontSize: '10px' }}>[=]</span>
          Saving: developer_genome_v{quantity}.dat
        </div>
        <div style={{ padding: '12px 16px' }}>
          {/* Flying file animation */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', marginBottom: '16px', height: '36px',
          }}>
            <span style={{ fontSize: '20px', filter: 'drop-shadow(1px 1px 0 #888)' }}>&#128196;</span>
            <div style={{ position: 'relative', width: '70px', height: '24px', overflow: 'hidden' }}>
              <span style={{
                position: 'absolute', left: 0, top: '2px',
                fontSize: '14px',
                animation: 'nxFlyFile 0.8s ease-in-out infinite',
              }}>&#128196;</span>
            </div>
            <span style={{ fontSize: '20px', filter: 'drop-shadow(1px 1px 0 #888)' }}>&#128194;</span>
          </div>

          {/* Saving from */}
          <div style={{ marginBottom: '10px', lineHeight: 1.6 }}>
            <div>
              Saving: <span style={{ fontWeight: 'bold' }}>developer_genome_v{quantity}.dat</span> from
            </div>
            <div style={{ color: '#00008B', textDecoration: 'underline' }}>
              nxterminal.corp/mint/deploy/{quantity}
            </div>
          </div>

          {/* Transfer stats */}
          <div style={{ marginBottom: '4px' }}>
            Estimated time left: {minsLeft > 0 ? `${minsLeft} min ` : ''}{secsRem} sec
            <span style={{ color: '#555' }}>
              {' '}({copiedKB.toLocaleString()} KB of {totalFileSize.toLocaleString()} KB copied)
            </span>
          </div>

          <div style={{ marginBottom: '4px' }}>
            Download to: <span style={{ color: '#00008B' }}>C:\NX_TERMINAL\devs\</span>
          </div>

          <div style={{ marginBottom: '12px' }}>
            Transfer rate: {transferSpeed} KB/Sec
          </div>

          {/* Progress bar — classic Windows blue */}
          <div style={{
            width: '100%', height: '18px',
            background: '#fff', border: '2px inset #808080',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round(copyProgress)}%`,
              height: '100%',
              background: '#000080',
              transition: 'width 0.2s linear',
            }} />
          </div>

          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <div style={{
              padding: '3px 24px',
              background: '#c0c0c0',
              border: '2px outset #dfdfdf',
              fontSize: '11px',
              fontFamily: "'Tahoma', sans-serif",
              color: '#888',
              cursor: 'default',
            }}>
              Cancel
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DEPLOYING ──
  if (phase === 'deploying') {
    return (
      <div style={dialogBg}>
        <style>{RETRO_KEYFRAMES}</style>
        <div style={titleBar}>
          <span style={{ fontSize: '10px' }}>[=]</span>
          Deploying Developer{quantity > 1 ? 's' : ''}...
        </div>
        <div style={{
          padding: '12px', background: '#0a0a0a', margin: '8px',
          border: '2px inset #808080',
          fontFamily: "'VT323', 'Courier New', monospace",
          fontSize: '13px', color: '#33ff33', lineHeight: 1.6,
          minHeight: '100px',
        }}>
          {DEPLOY_STEPS.slice(0, deployStep + 1).map((step, i) => (
            <div key={i} style={{
              color: i === DEPLOY_STEPS.length - 1 ? '#ffaa00' : '#33ff33',
            }}>
              {'>'} {step.text}
            </div>
          ))}
          {deployStep < DEPLOY_STEPS.length - 1 && (
            <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
          )}
        </div>
      </div>
    );
  }

  // ── DONE — Show GIFs ──
  return (
    <div style={dialogBg}>
      <style>{RETRO_KEYFRAMES}</style>
      <div style={{
        ...titleBar,
        background: 'linear-gradient(90deg, #006400, #00aa00)',
      }}>
        <span style={{ fontSize: '10px' }}>[=]</span>
        Deployment Complete
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          fontWeight: 'bold', fontSize: '13px',
          color: '#006400', marginBottom: '8px',
          textAlign: 'center',
        }}>
          {quantity} developer{quantity > 1 ? 's' : ''} deployed to the Protocol Wars!
        </div>

        {/* Show minted dev GIFs */}
        {mintedDevs.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '8px',
            justifyContent: 'center', marginBottom: '12px',
            padding: '8px',
            background: '#000',
            border: '2px inset #808080',
          }}>
            {mintedDevs.map(dev => (
              <div key={dev.token_id} style={{
                textAlign: 'center',
                padding: '4px',
              }}>
                <div style={{
                  width: '96px', height: '96px',
                  background: '#111',
                  border: '1px solid #444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', marginBottom: '4px',
                }}>
                  {dev.ipfs_hash ? (
                    <img
                      src={`${IPFS_GW}${dev.ipfs_hash}`}
                      alt={dev.name}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', imageRendering: 'pixelated',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '32px', color: '#555', fontFamily: 'monospace' }}>@</span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#33ff33', fontWeight: 'bold', fontFamily: "'VT323', monospace" }}>
                  {dev.name}
                </div>
                <div style={{ fontSize: '9px', color: '#888', fontFamily: "'VT323', monospace" }}>
                  #{dev.token_id}
                </div>
              </div>
            ))}
          </div>
        )}

        {mintedIds.length > 0 && mintedDevs.length === 0 && (
          <div style={{
            padding: '8px', background: '#000', border: '2px inset #808080',
            marginBottom: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '10px', color: '#888', fontFamily: "'VT323', monospace" }}>
              Token ID{mintedIds.length > 1 ? 's' : ''}: {mintedIds.map(id => `#${id}`).join(', ')}
            </div>
          </div>
        )}

        {txHash && (
          <div style={{ fontSize: '10px', color: '#555', textAlign: 'center', marginBottom: '8px' }}>
            TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
          <button
            className="win-btn"
            onClick={() => openWindow?.('my-devs')}
            style={{ padding: '4px 16px', fontWeight: 'bold' }}
          >
            View Developer{mintedIds.length > 1 ? 's' : ''}
          </button>
          <button
            className="win-btn"
            onClick={onReset}
            style={{ padding: '4px 16px' }}
          >
            Mint Another
          </button>
        </div>
      </div>
    </div>
  );
}

const PHASE_CLOSED = 0;
const PHASE_WHITELIST = 1;
const PHASE_PUBLIC = 2;

const PHASE_LABELS = {
  [PHASE_CLOSED]: 'CLOSED',
  [PHASE_WHITELIST]: 'WHITELIST',
  [PHASE_PUBLIC]: 'PUBLIC',
};

const QUESTIONS = [
  {
    id: 'specialty',
    question: 'What should your developer specialize in?',
    options: [
      { id: 'code', label: 'Full-Stack Coding', desc: 'Pure code output. Ship fast, break things faster.' },
      { id: 'security', label: 'Security & Hacking', desc: 'Offense is the best defense. Or so they claim.' },
      { id: 'trading', label: 'DeFi & Trading', desc: 'Numbers go up. Sometimes down. Mostly down.' },
      { id: 'research', label: 'AI Research', desc: 'Publish papers nobody reads. Get cited by everyone.' },
    ],
  },
  {
    id: 'strategy',
    question: 'How should they approach the Protocol Wars?',
    options: [
      { id: 'aggressive', label: 'Aggressive', desc: 'Attack first, ask questions never.' },
      { id: 'balanced', label: 'Balanced', desc: 'A little coding, a little sabotage. Work-life balance.' },
      { id: 'stealth', label: 'Stealth', desc: 'Stay quiet. Accumulate. Strike when they least expect.' },
      { id: 'chaotic', label: 'Chaotic', desc: 'No plan. No rules. Maximum entropy.' },
    ],
  },
];

export default function HireDevs({ onMint, openDevProfile, openWindow }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [mintError, setMintError] = useState(null);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  const { address, isConnected, isConnecting, connect, displayAddress } = useWallet();

  // ── Contract reads ───────────────────────────────────────
  const { data: mintPrice } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'mintPrice',
  });

  const { data: mintPhase } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'mintPhase',
  });

  const { data: remaining } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'remainingSupply',
  });

  const { data: freeAllowance } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'freeMintAllowance',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: isWhitelisted } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'whitelisted',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // ── Contract write ───────────────────────────────────────
  const { writeContract, data: txHash, isPending: isMinting, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Surface write errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.shortMessage || writeError.message || 'Transaction failed';
      setMintError(msg);
    }
  }, [writeError]);

  // Handle successful mint — trigger animation
  useEffect(() => {
    if (isConfirmed && txHash) {
      setMintSuccess(true);
      setShowAnimation(true);
      setMintError(null);
      // Track minted devs in localStorage and notify LiveFeed
      const current = parseInt(localStorage.getItem('nx-minted-devs') || '0', 10);
      localStorage.setItem('nx-minted-devs', String(current + quantity));
      window.dispatchEvent(new CustomEvent('nx-dev-minted', { detail: { count: current + quantity, added: quantity } }));
      if (onMint) onMint(answers, quantity, address);
    }
  }, [isConfirmed, txHash]);

  const handleAnimationReset = () => {
    setShowAnimation(false);
    setMintSuccess(false);
    setStep(0);
    setAnswers({});
    setQuantity(1);
  };

  // ── Derived state ────────────────────────────────────────
  const phase = mintPhase != null ? Number(mintPhase) : null;
  const isClosed = phase == null || phase === PHASE_CLOSED;
  const hasFreeMint = freeAllowance != null && Number(freeAllowance) > 0;
  const canWhitelistMint = phase === PHASE_WHITELIST && isWhitelisted;
  const canPublicMint = phase === PHASE_PUBLIC;
  const canMint = hasFreeMint || canWhitelistMint || canPublicMint;

  const pricePerUnit = mintPrice != null ? mintPrice : 0n;
  const priceDisplay = mintPrice != null ? formatEther(mintPrice) : '...';
  const totalCost = mintPrice != null ? mintPrice * BigInt(quantity) : 0n;
  const totalCostDisplay = mintPrice != null ? formatEther(totalCost) : '...';
  const remainingDisplay = remaining != null ? Number(remaining).toLocaleString() : '...';

  // Determine which mint function to call
  const getMintMethod = () => {
    if (hasFreeMint && Number(freeAllowance) >= quantity) {
      return 'free';
    }
    if (phase === PHASE_WHITELIST && isWhitelisted) {
      return 'whitelist';
    }
    return 'public';
  };

  const handleAnswer = (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (step < QUESTIONS.length) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleMint = () => {
    if (!isConnected) {
      connect();
      return;
    }

    setMintError(null);
    setMintSuccess(false);
    const method = getMintMethod();

    if (method === 'free') {
      writeContract({
        address: NXDEVNFT_ADDRESS,
        abi: NXDEVNFT_ABI,
        functionName: 'freeMint',
        args: [BigInt(quantity)],
      });
    } else if (method === 'whitelist') {
      writeContract({
        address: NXDEVNFT_ADDRESS,
        abi: NXDEVNFT_ABI,
        functionName: 'whitelistMint',
        args: [BigInt(quantity)],
        value: pricePerUnit * BigInt(quantity),
      });
    } else {
      writeContract({
        address: NXDEVNFT_ADDRESS,
        abi: NXDEVNFT_ABI,
        functionName: 'mint',
        args: [BigInt(quantity)],
        value: pricePerUnit * BigInt(quantity),
      });
    }
  };

  const currentQuestion = QUESTIONS[step];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const mintMethod = getMintMethod();
  const isFree = mintMethod === 'free';
  const txBusy = isMinting || isConfirming;

  // ── Mint button label ────────────────────────────────────
  const getMintButtonLabel = () => {
    if (!isConnected) return isConnecting ? 'Connecting...' : 'Connect Wallet to Mint';
    if (isMinting) return 'Confirm in Wallet...';
    if (isConfirming) return 'Confirming...';
    if (isFree) return `FREE MINT (${Number(freeAllowance)} left)`;
    return 'MINT DEVELOPERS';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-amber)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{'>'} DEVELOPER MINTING TERMINAL — Configure & Deploy</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
          {phase != null && (
            <span style={{
              color: isClosed ? 'var(--terminal-red)' : 'var(--terminal-green)',
            }}>
              [{PHASE_LABELS[phase] || 'UNKNOWN'}]
            </span>
          )}
          <span style={{ color: '#888' }}>{remainingDisplay} left</span>
          {isConnected && (
            <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', alignItems: 'center' }}>
          {QUESTIONS.map((q, i) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '0',
                background: step > i ? 'var(--terminal-green)' : step === i ? 'var(--terminal-amber)' : 'var(--border-dark)',
                color: step >= i ? '#000' : '#666',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 'bold',
                border: '1px solid var(--border-darker)',
              }}>
                {step > i ? 'OK' : i + 1}
              </div>
              {i < QUESTIONS.length - 1 && (
                <div style={{ width: '24px', height: '2px', background: step > i ? 'var(--terminal-green)' : 'var(--border-dark)' }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '24px', height: '2px', background: step >= QUESTIONS.length ? 'var(--terminal-green)' : 'var(--border-dark)' }} />
            <div style={{
              width: '20px', height: '20px',
              background: step >= QUESTIONS.length ? 'var(--gold)' : 'var(--border-dark)',
              color: step >= QUESTIONS.length ? '#000' : '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 'bold',
              border: '1px solid var(--border-darker)',
            }}>
              {'+'}
            </div>
          </div>
          <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>
            {step < QUESTIONS.length ? `Step ${step + 1} of ${QUESTIONS.length}` : 'Ready to Mint'}
          </span>
        </div>

        {/* Question phase */}
        {step < QUESTIONS.length && (
          <div>
            <div style={{
              fontWeight: 'bold', fontSize: '13px', marginBottom: '12px',
              color: 'var(--win-title-l)', padding: '4px 0',
            }}>
              {currentQuestion.question}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {currentQuestion.options.map(opt => (
                <div
                  key={opt.id}
                  className={currentAnswer === opt.id ? 'win-panel' : 'win-raised'}
                  style={{
                    padding: '10px', cursor: 'pointer',
                    border: currentAnswer === opt.id ? '2px solid var(--terminal-green)' : '2px solid transparent',
                  }}
                  onClick={() => handleAnswer(currentQuestion.id, opt.id)}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: '#444', lineHeight: 1.3 }}>{opt.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              {step > 0 && (
                <button className="win-btn" onClick={handleBack} style={{ padding: '4px 16px' }}>{'< Back'}</button>
              )}
              <button className="win-btn" onClick={handleNext} disabled={!currentAnswer} style={{ padding: '4px 16px', fontWeight: 'bold' }}>
                {'Next >'}
              </button>
            </div>
          </div>
        )}

        {/* Mint confirmation phase */}
        {step >= QUESTIONS.length && (
          <div>
            {/* Mint closed banner */}
            {isClosed && !hasFreeMint && (
              <div className="win-raised" style={{
                padding: '12px', marginBottom: '12px',
                border: '2px solid var(--terminal-red)',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--terminal-red)', marginBottom: '4px' }}>
                  MINTING IS CURRENTLY CLOSED
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Check back soon. Follow our announcements for the next mint phase.
                </div>
              </div>
            )}

            <div className="win-panel" style={{ padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', color: 'var(--win-title-l)' }}>
                Developer Configuration Summary
              </div>
              {QUESTIONS.map(q => {
                const selected = q.options.find(o => o.id === answers[q.id]);
                return (
                  <div key={q.id} style={{ fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: '#666' }}>{q.question}</span>{' '}
                    <span style={{ fontWeight: 'bold' }}>{selected?.label || '—'}</span>
                  </div>
                );
              })}
              <div style={{ fontSize: '10px', color: '#999', marginTop: '8px', fontStyle: 'italic' }}>
                Corporation will be assigned from NFT metadata upon minting.
              </div>
            </div>

            <div className="win-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Quantity:</span>
                <button className="win-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={txBusy} style={{ padding: '2px 8px' }}>-</button>
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '18px', minWidth: '30px', textAlign: 'center' }}>{quantity}</span>
                <button className="win-btn" onClick={() => setQuantity(q => Math.min(20, q + 1))} disabled={txBusy} style={{ padding: '2px 8px' }}>+</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '11px' }}>
                  {isFree ? (
                    <span style={{ fontWeight: 'bold', color: 'var(--terminal-green)' }}>FREE MINT</span>
                  ) : (
                    <>
                      Cost: <span style={{ fontWeight: 'bold', color: 'var(--gold)' }}>
                        {priceDisplay} ETH x {quantity} = {totalCostDisplay} ETH
                      </span>
                    </>
                  )}
                </div>
                <button
                  className="win-btn"
                  onClick={handleMint}
                  disabled={txBusy || phase == null || (isClosed && !hasFreeMint)}
                  style={{ padding: '4px 16px', fontWeight: 'bold' }}
                >
                  {getMintButtonLabel()}
                </button>
              </div>

              {isConnected && (
                <div style={{ fontSize: '10px', marginTop: '6px', color: '#888' }}>
                  {hasFreeMint && (
                    <span style={{ color: 'var(--terminal-green)' }}>
                      Free mints available: {Number(freeAllowance)}{' | '}
                    </span>
                  )}
                  {canWhitelistMint && (
                    <span style={{ color: 'var(--terminal-cyan)' }}>
                      Whitelisted{' | '}
                    </span>
                  )}
                  <span style={{ color: 'var(--terminal-green)' }}>Connected: {displayAddress}</span>
                </div>
              )}
            </div>

            {/* Transaction status */}
            {txHash && !mintSuccess && (
              <div className="win-panel" style={{
                marginTop: '12px', padding: '10px 12px',
                fontFamily: "'VT323', monospace", fontSize: '13px',
                background: 'var(--terminal-bg)', color: 'var(--terminal-amber)',
              }}>
                {'>'} Transaction sent: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <br />
                {'>'} Waiting for confirmation...
              </div>
            )}

            {/* Mint success — animated deploy sequence */}
            {showAnimation && (
              <div style={{ marginTop: '12px' }}>
                <MintAnimation
                  quantity={quantity}
                  txHash={txHash}
                  address={address}
                  openDevProfile={openDevProfile}
                  openWindow={openWindow}
                  onReset={handleAnimationReset}
                />
              </div>
            )}

            {/* Mint error */}
            {mintError && (
              <div className="win-raised" style={{
                marginTop: '12px', padding: '10px 12px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                border: '2px solid var(--terminal-red)',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0, fontWeight: 'bold' }}>[!]</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px', color: 'var(--terminal-red)' }}>
                    Mint Error
                  </div>
                  <div style={{ fontSize: '10px', marginBottom: '8px' }}>{mintError}</div>
                  <button className="win-btn" onClick={() => setMintError(null)} style={{ fontSize: '10px', padding: '2px 12px' }}>OK</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="win-btn" onClick={handleBack} disabled={txBusy} style={{ padding: '4px 16px' }}>{'< Back'}</button>
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: '4px 8px', borderTop: '1px solid var(--border-dark)',
        fontSize: '10px', color: '#666', textAlign: 'center',
      }}>
        Each developer is a unique AI agent with randomized traits and abilities. Corporation assigned via metadata. No refunds.
      </div>
    </div>
  );
}
