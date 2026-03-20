import { AlertTriangle } from 'lucide-react';
import { useWallet } from '../../../../../hooks/useWallet';
import { useBuild } from '../../BuildContext';
import Button from '../shared/Button';

export default function DeployForm({ onDeploy }) {
  const { state, dispatch } = useBuild();
  const { isConnected, connect, displayAddress, isWrongChain, switchToMonad } = useWallet();

  const isMainnet = state.network === 'mainnet';

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Deploy Configuration</h3>

      <div className="mb-flex mb-items-center mb-gap-md mb-mb-md">
        <span className="mb-text-sm" style={{ fontWeight: 500 }}>Network:</span>
        <div className="mb-network-toggle">
          <button
            className={state.network === 'testnet' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_NETWORK', payload: 'testnet' })}
          >
            Testnet
          </button>
          <button
            className={state.network === 'mainnet' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_NETWORK', payload: 'mainnet' })}
          >
            Mainnet
          </button>
        </div>
      </div>

      {isMainnet && (
        <div className="mb-callout mb-callout-warning mb-mb-md">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>You are deploying to <strong>Pharos Mainnet</strong>. This will use real PHRS tokens.</span>
        </div>
      )}

      <div className="mb-card mb-mb-md">
        <div className="mb-flex mb-items-center mb-justify-between">
          <div>
            <div className="mb-text-xs" style={{ color: 'var(--mb-text-tertiary)', marginBottom: 4 }}>Wallet</div>
            {isConnected ? (
              <span className="mb-text-mono" style={{ fontSize: 13 }}>{displayAddress}</span>
            ) : (
              <span className="mb-text-sm">Not connected</span>
            )}
          </div>
          {!isConnected ? (
            <Button size="sm" onClick={connect}>Connect Wallet</Button>
          ) : isWrongChain ? (
            <Button size="sm" onClick={switchToMonad}>Switch to Pharos</Button>
          ) : (
            <span className="mb-badge mb-badge-green">Connected</span>
          )}
        </div>
      </div>

      <div className="mb-callout mb-callout-warning mb-mb-md">
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <div>
          <strong>Pharos charges the full gas LIMIT, not gas used.</strong>
          <br />
          The estimated cost reflects the maximum you will pay. Always use gas estimation.
        </div>
      </div>

      <Button
        onClick={onDeploy}
        disabled={!isConnected || isWrongChain}
        style={{ width: '100%', padding: '12px 16px', fontSize: 15 }}
      >
        {!isConnected
          ? 'Connect Wallet to Deploy'
          : isWrongChain
            ? 'Switch to Pharos Network'
            : 'Deploy Contract'}
      </Button>
    </div>
  );
}
