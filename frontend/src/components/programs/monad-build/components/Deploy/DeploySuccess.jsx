import { useState } from 'react';
import { CheckCircle2, ExternalLink, Copy, Check, Share2, Hammer } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import { MONAD_MAINNET, MONAD_TESTNET } from '../../constants/monad';
import Button from '../shared/Button';
import Card from '../shared/Card';

export default function DeploySuccess() {
  const { state, dispatch } = useBuild();
  const [copied, setCopied] = useState(false);
  const config = state.network === 'mainnet' ? MONAD_MAINNET : MONAD_TESTNET;

  function handleCopy() {
    navigator.clipboard.writeText(state.deployedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    const text = encodeURIComponent(
      `Just deployed my contract on @monad_xyz in under 1 second! Built with #NXTerminal MONAD_BUILD.exe\n\n${config.explorer}/address/${state.deployedAddress}`
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
  }

  return (
    <div className="mb-animate-in" style={{ textAlign: 'center', padding: '20px 0' }}>
      <div className="mb-scale-in" style={{ marginBottom: 20 }}>
        <CheckCircle2 size={56} style={{ color: 'var(--mb-accent-secondary)' }} />
      </div>

      <h2 className="mb-h2 mb-mb-sm">Contract Deployed!</h2>
      <p className="mb-text-sm mb-mb-lg">
        Your contract is live on {state.network === 'mainnet' ? 'Monad Mainnet' : 'Monad Testnet'}.
      </p>

      <div className="mb-card mb-mb-lg" style={{ textAlign: 'left' }}>
        <div className="mb-text-xs mb-mb-sm" style={{ color: 'var(--mb-text-tertiary)' }}>Contract Address</div>
        <div className="mb-flex mb-items-center mb-gap-sm">
          <code style={{
            fontFamily: 'var(--mb-font-mono)',
            fontSize: 14,
            color: 'var(--mb-accent-primary)',
            flex: 1,
            wordBreak: 'break-all',
          }}>
            {state.deployedAddress}
          </code>
          <Button variant="ghost" size="sm" icon onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </div>

      <div className="mb-grid-2 mb-mb-lg">
        <a
          href={`${config.explorer}/address/${state.deployedAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-btn mb-btn-secondary"
          style={{ textDecoration: 'none', justifyContent: 'center' }}
        >
          View on MonadVision <ExternalLink size={14} />
        </a>
        {state.txHash && (
          <a
            href={`${config.explorer}/tx/${state.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-btn mb-btn-secondary"
            style={{ textDecoration: 'none', justifyContent: 'center' }}
          >
            View Transaction <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div className="mb-grid-2 mb-mb-lg">
        <Card onClick={handleShare}>
          <Share2 size={18} style={{ color: 'var(--mb-accent-info)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Share on X</div>
          <div className="mb-text-sm">Tell the world about your deploy</div>
        </Card>
        <Card onClick={() => {
          dispatch({ type: 'RESET_BUILD' });
          dispatch({ type: 'SET_MODULE', payload: 'build' });
        }}>
          <Hammer size={18} style={{ color: 'var(--mb-accent-primary)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Build Another</div>
          <div className="mb-text-sm">Create a new contract</div>
        </Card>
      </div>
    </div>
  );
}
