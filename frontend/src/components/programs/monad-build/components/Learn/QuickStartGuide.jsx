import { useState } from 'react';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { useWallet } from '../../../../../hooks/useWallet';
import { useBuild } from '../../BuildContext';
import { FAUCETS } from '../../constants/monad';
import Button from '../shared/Button';

const STEPS = [
  { title: 'Connect Wallet', desc: 'Connect your MetaMask or compatible wallet.' },
  { title: 'Switch to MegaETH', desc: 'Make sure you\'re on the MegaETH network.' },
  { title: 'Get Test ETH', desc: 'Grab free testnet tokens from a faucet.' },
  { title: 'Create Your First Contract', desc: 'Use the Build wizard to generate a contract.' },
  { title: 'Deploy', desc: 'Ship your contract to MegaETH.' },
];

export default function QuickStartGuide() {
  const [completed, setCompleted] = useState({});
  const { isConnected, connect, isWrongChain, switchToMegaETH } = useWallet();
  const { dispatch } = useBuild();

  function toggleStep(i) {
    setCompleted(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const completedCount = Object.values(completed).filter(Boolean).length;

  return (
    <div>
      <h2 className="mb-h2 mb-mb-sm">5-Minute Quick Start</h2>
      <p className="mb-text-sm mb-mb-md">Get from zero to deployed in 5 steps.</p>

      <div style={{
        height: 4,
        background: 'var(--mb-bg-tertiary)',
        borderRadius: 2,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(completedCount / 5) * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #836EF9, #22C55E)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div className="mb-flex-col mb-gap-md">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="mb-card"
            style={{ borderColor: completed[i] ? 'rgba(34,197,94,0.3)' : undefined }}
          >
            <div className="mb-flex mb-items-center mb-gap-md">
              <button
                onClick={() => toggleStep(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {completed[i]
                  ? <CheckCircle2 size={22} style={{ color: 'var(--mb-accent-secondary)' }} />
                  : <Circle size={22} style={{ color: 'var(--mb-text-tertiary)' }} />
                }
              </button>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: completed[i] ? 'line-through' : 'none',
                  color: completed[i] ? 'var(--mb-text-tertiary)' : 'var(--mb-text-primary)',
                }}>
                  Step {i + 1}: {step.title}
                </div>
                <div className="mb-text-sm">{step.desc}</div>
              </div>
              <div>
                {i === 0 && !isConnected && (
                  <Button size="sm" onClick={connect}>Connect</Button>
                )}
                {i === 0 && isConnected && !completed[0] && (
                  <Button size="sm" variant="secondary" onClick={() => toggleStep(0)}>
                    Connected
                  </Button>
                )}
                {i === 1 && isConnected && isWrongChain && (
                  <Button size="sm" onClick={switchToMegaETH}>Switch Network</Button>
                )}
                {i === 2 && (
                  <a
                    href={FAUCETS[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-btn mb-btn-secondary mb-btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Get ETH <ExternalLink size={12} />
                  </a>
                )}
                {i === 3 && (
                  <Button
                    size="sm"
                    onClick={() => dispatch({ type: 'SET_MODULE', payload: 'build' })}
                  >
                    Build
                  </Button>
                )}
                {i === 4 && (
                  <Button
                    size="sm"
                    onClick={() => dispatch({ type: 'SET_MODULE', payload: 'deploy' })}
                  >
                    Deploy
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
