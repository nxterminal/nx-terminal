import { Loader2, Check, X, ExternalLink } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import { MONAD_MAINNET, MONAD_TESTNET } from '../../constants/monad';

const PHASES = [
  { key: 'compiling', label: 'Preparing Transaction...', desc: 'Building deployment transaction' },
  { key: 'signing', label: 'Waiting for Wallet Signature...', desc: 'Confirm in your wallet' },
  { key: 'pending', label: 'Transaction Pending...', desc: 'Pharos confirms in sub-second' },
  { key: 'confirmed', label: 'Confirmed!', desc: 'Contract deployed successfully' },
];

function getPhaseIndex(status) {
  switch (status) {
    case 'compiling': return 0;
    case 'signing': return 1;
    case 'pending': return 2;
    case 'confirmed': return 3;
    case 'error': return -1;
    default: return -1;
  }
}

export default function DeployStatus() {
  const { state } = useBuild();
  const currentPhase = getPhaseIndex(state.deployStatus);
  const config = state.network === 'mainnet' ? MONAD_MAINNET : MONAD_TESTNET;

  if (state.deployStatus === 'idle') return null;

  return (
    <div className="mb-animate-in">
      <h3 className="mb-h3 mb-mb-md">Deployment Progress</h3>

      <div className="mb-flex-col">
        {PHASES.map((phase, i) => {
          const isActive = i === currentPhase;
          const isCompleted = i < currentPhase;
          const isError = state.deployStatus === 'error' && i === currentPhase;

          return (
            <div key={phase.key} className="mb-deploy-step">
              <div className="mb-deploy-step-indicator">
                <div className={`mb-deploy-step-dot ${isCompleted ? 'completed' : isActive ? 'active' : isError ? 'error' : ''}`}>
                  {isCompleted ? <Check size={12} /> : isActive ? <Loader2 size={12} className="mb-spin" /> : isError ? <X size={12} /> : ''}
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`mb-deploy-step-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: isActive || isCompleted ? 'var(--mb-text-primary)' : 'var(--mb-text-tertiary)',
                }}>
                  {phase.label}
                </div>
                <div className="mb-text-sm">{phase.desc}</div>
                {phase.key === 'pending' && state.txHash && (
                  <a
                    href={`${config.explorer}/tx/${state.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-flex mb-items-center mb-gap-sm mb-mt-sm"
                    style={{ fontSize: 12, color: 'var(--mb-accent-primary)', textDecoration: 'none' }}
                  >
                    View Transaction <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state.deployStatus === 'error' && (
        <div className="mb-callout mb-callout-error">
          Deployment failed. Please check your wallet and try again.
        </div>
      )}
    </div>
  );
}
