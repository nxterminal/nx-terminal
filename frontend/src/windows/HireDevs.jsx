import { useState, useCallback } from 'react';

const MINT_COST = '0.05 ETH';

const WALLETS = [
  { id: 'metamask', name: 'MetaMask', icon: '[M]', detect: () => !!window.ethereum?.isMetaMask },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '[C]', detect: () => !!window.ethereum?.isCoinbaseWallet },
  { id: 'walletconnect', name: 'WalletConnect', icon: '[W]', detect: () => false },
  { id: 'injected', name: 'Browser Wallet', icon: '[B]', detect: () => !!window.ethereum },
];

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

export default function HireDevs({ onMint }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletError, setWalletError] = useState(null);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async (walletId) => {
    setConnecting(true);
    setWalletError(null);
    setShowWalletPicker(false);

    try {
      if (walletId === 'walletconnect') {
        setWalletError('WalletConnect integration coming soon. Please use MetaMask or another browser wallet.');
        setConnecting(false);
        return;
      }

      if (!window.ethereum) {
        setWalletError('No wallet extension detected. Please install MetaMask or a compatible Web3 wallet.');
        setConnecting(false);
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setWalletError(null);
      }
    } catch (err) {
      if (err.code === 4001) {
        setWalletError('Connection rejected. You must approve the wallet connection to mint.');
      } else {
        setWalletError(`Failed to connect: ${err.message || 'Unknown error'}`);
      }
    }
    setConnecting(false);
  }, []);

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
    if (!walletAddress) {
      setShowWalletPicker(true);
      return;
    }
    if (onMint) onMint(answers, quantity, walletAddress);
  };

  const truncAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const currentQuestion = QUESTIONS[step];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

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
        {walletAddress && (
          <span style={{ fontSize: '12px', color: 'var(--terminal-green)' }}>
            {truncAddr}
          </span>
        )}
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
                <button className="win-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '2px 8px' }}>-</button>
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '18px', minWidth: '30px', textAlign: 'center' }}>{quantity}</span>
                <button className="win-btn" onClick={() => setQuantity(q => Math.min(10, q + 1))} style={{ padding: '2px 8px' }}>+</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '11px' }}>
                  Cost: <span style={{ fontWeight: 'bold', color: 'var(--gold)' }}>{MINT_COST} x {quantity} = {(0.05 * quantity).toFixed(2)} ETH</span>
                </div>
                <button
                  className="win-btn"
                  onClick={handleMint}
                  disabled={connecting}
                  style={{ padding: '4px 16px', fontWeight: 'bold' }}
                >
                  {connecting ? 'Connecting...' : walletAddress ? 'MINT DEVELOPERS' : 'Connect Wallet to Mint'}
                </button>
              </div>

              {walletAddress && (
                <div style={{ fontSize: '10px', color: 'var(--terminal-green)', marginTop: '6px' }}>
                  Connected: {truncAddr}
                </div>
              )}
            </div>

            {walletError && (
              <div className="win-raised" style={{
                marginTop: '12px', padding: '10px 12px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                border: '2px solid var(--terminal-red)',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0, fontWeight: 'bold' }}>[!]</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px', color: 'var(--terminal-red)' }}>
                    Wallet Connection Error
                  </div>
                  <div style={{ fontSize: '10px', marginBottom: '8px' }}>{walletError}</div>
                  <button className="win-btn" onClick={() => setWalletError(null)} style={{ fontSize: '10px', padding: '2px 12px' }}>OK</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="win-btn" onClick={handleBack} style={{ padding: '4px 16px' }}>{'< Back'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Picker Dialog */}
      {showWalletPicker && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div className="win-raised" style={{
            width: '320px', background: 'var(--win-bg, #c0c0c0)',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #0a246a, #3a6ea5)',
              color: '#fff', padding: '3px 6px', fontSize: '11px', fontWeight: 'bold',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Connect Wallet</span>
              <button
                onClick={() => setShowWalletPicker(false)}
                style={{
                  background: 'var(--win-bg, #c0c0c0)', border: '1px outset #ddd',
                  width: '16px', height: '14px', fontSize: '9px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
              >
                X
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px' }}>
                Select a wallet to connect:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {WALLETS.map(w => {
                  const available = w.detect();
                  return (
                    <button
                      key={w.id}
                      className="win-btn"
                      onClick={() => connectWallet(w.id)}
                      disabled={connecting}
                      style={{
                        padding: '8px 12px', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        opacity: (w.id === 'walletconnect' || available || w.id === 'injected') ? 1 : 0.5,
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{w.icon}</span>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{w.name}</div>
                        <div style={{ fontSize: '9px', color: '#666' }}>
                          {w.id === 'walletconnect' ? 'Scan QR code' : available ? 'Detected' : 'Not detected'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <button className="win-btn" onClick={() => setShowWalletPicker(false)} style={{ padding: '3px 20px', fontSize: '11px' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{
        padding: '4px 8px', borderTop: '1px solid var(--border-dark)',
        fontSize: '10px', color: '#666', textAlign: 'center',
      }}>
        Each developer is a unique AI agent with randomized traits and abilities. Corporation assigned via metadata. No refunds.
      </div>
    </div>
  );
}
