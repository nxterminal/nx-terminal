import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI } from '../services/contract';
import { api } from '../services/api';

// ── Post-mint deploy animation ──────────────────────────────
const DEPLOY_STEPS = [
  { text: 'Connecting to MegaETH mainnet...', duration: 800 },
  { text: 'Downloading developer genome...', duration: 1000 },
  { text: 'Installing neural pathways...', duration: 800 },
  { text: 'Compiling personality matrix...', duration: 1200 },
  { text: 'Deploying to corporation...', duration: 1000 },
  { text: 'Developer deployed successfully!', duration: 0 },
];

function MintAnimation({ quantity, txHash, address, openDevProfile, onReset }) {
  const [phase, setPhase] = useState('dialup'); // dialup | copying | deploying | done
  const [dialStep, setDialStep] = useState(0);
  const [deployStep, setDeployStep] = useState(-1);
  const [copyProgress, setCopyProgress] = useState(0);
  const [mintedIds, setMintedIds] = useState([]);
  const timerRef = useRef(null);

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
      // Last N minted tokens (most recent)
      const ids = ownedTokens.slice(-quantity).map(id => Number(id));
      setMintedIds(ids);

      // Dispatch events for Inbox and NXAssistant with dev data
      ids.forEach(tokenId => {
        api.getDev(tokenId)
          .then(dev => {
            window.dispatchEvent(new CustomEvent('nx-dev-hired', { detail: { dev } }));
          })
          .catch(() => {
            // Fallback: dispatch with minimal info
            window.dispatchEvent(new CustomEvent('nx-dev-hired', {
              detail: { dev: { token_id: tokenId, name: `Dev #${tokenId}`, corporation: 'UNKNOWN', archetype: 'UNKNOWN', species: 'Unknown' } },
            }));
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

  // ── Copy phase ──
  useEffect(() => {
    if (phase !== 'copying') return;
    if (copyProgress >= 100) {
      timerRef.current = setTimeout(() => {
        setPhase('deploying');
        setDeployStep(0);
      }, 400);
      return;
    }
    const increment = Math.random() * 15 + 3;
    timerRef.current = setTimeout(
      () => setCopyProgress(p => Math.min(100, p + increment)),
      150 + Math.random() * 200,
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
      // last step — stay
      timerRef.current = setTimeout(() => setPhase('done'), 800);
      return;
    }
    timerRef.current = setTimeout(() => setDeployStep(s => s + 1), step.duration);
    return () => clearTimeout(timerRef.current);
  }, [phase, deployStep]);

  // Cleanup
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const termStyle = {
    background: '#0a0a0a',
    border: '1px solid #333',
    padding: '10px 12px',
    fontFamily: "'VT323', monospace",
    fontSize: '13px',
    color: '#33ff33',
    lineHeight: 1.6,
    minHeight: '120px',
  };

  // ── DIAL-UP ──
  if (phase === 'dialup') {
    return (
      <div>
        <div className="win-raised" style={{ padding: '8px 12px', marginBottom: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Connecting to NX Terminal Corp.</span>
        </div>
        <div style={termStyle}>
          <div style={{ marginBottom: '6px', color: '#ffaa00' }}>
            {'  '}[=PC=]---{'((☎))'}---[🌐]
          </div>
          {DIAL_LINES.slice(0, dialStep).map((line, i) => (
            <div key={i}>{'>'} {line}</div>
          ))}
          <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
        </div>
      </div>
    );
  }

  // ── COPYING FILES ──
  if (phase === 'copying') {
    const filled = Math.round(copyProgress / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    return (
      <div>
        <div className="win-raised" style={{ padding: '8px 12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📁→📂</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Copying developer files...</span>
          </div>
        </div>
        <div style={termStyle}>
          <div>Copying genome_v{Math.floor(Math.random() * 9) + 1}.dat</div>
          <div>Copying neural_net.bin</div>
          <div>Copying personality.cfg</div>
          <div style={{ marginTop: '8px' }}>
            [{bar}] {Math.round(copyProgress)}%
          </div>
        </div>
      </div>
    );
  }

  // ── DEPLOYING ──
  if (phase === 'deploying') {
    return (
      <div>
        <div className="win-raised" style={{ padding: '8px 12px', marginBottom: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Deploying Developer{quantity > 1 ? 's' : ''}...</span>
        </div>
        <div style={termStyle}>
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

  // ── DONE ──
  return (
    <div>
      <div className="win-raised" style={{
        padding: '12px',
        border: '2px solid var(--terminal-green)',
        marginBottom: '8px',
      }}>
        <div style={{
          fontWeight: 'bold', fontSize: '14px',
          color: 'var(--terminal-green)', marginBottom: '8px',
          textAlign: 'center',
        }}>
          DEPLOYMENT COMPLETE
        </div>
        <div style={{ fontSize: '11px', textAlign: 'center', marginBottom: '8px' }}>
          {quantity} developer{quantity > 1 ? 's' : ''} deployed to the Protocol Wars
        </div>

        {mintedIds.length > 0 && (
          <div className="win-panel" style={{ padding: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Token ID{mintedIds.length > 1 ? 's' : ''}:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {mintedIds.map(id => (
                <button
                  key={id}
                  className="win-btn"
                  onClick={() => openDevProfile?.(id)}
                  style={{ fontSize: '11px', padding: '3px 10px' }}
                >
                  Dev #{id}
                </button>
              ))}
            </div>
          </div>
        )}

        {txHash && (
          <div style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginBottom: '8px' }}>
            TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {mintedIds.length === 1 && (
            <button
              className="win-btn"
              onClick={() => openDevProfile?.(mintedIds[0])}
              style={{ padding: '4px 16px', fontWeight: 'bold' }}
            >
              View Developer
            </button>
          )}
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

export default function HireDevs({ onMint, openDevProfile }) {
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
  const isClosed = phase === PHASE_CLOSED;
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
                  disabled={txBusy || (isClosed && !hasFreeMint)}
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
