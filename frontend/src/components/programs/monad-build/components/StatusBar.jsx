import { useBuild } from '../BuildContext';
import { useMonadNetwork } from '../hooks/useMonadNetwork';
import { useWallet } from '../../../../hooks/useWallet';

export default function StatusBar() {
  const { state } = useBuild();
  const { blockNumber, gasPrice, isLoading } = useMonadNetwork(state.network);
  const { isConnected, displayAddress, connect } = useWallet();

  const networkLabel = state.network === 'mainnet' ? 'MegaETH Mainnet' : 'MegaETH Testnet';

  return (
    <div className="mb-statusbar">
      <div className="mb-statusbar-left">
        <span className={`mb-status-dot ${isLoading ? 'warning' : ''}`} />
        <span>{networkLabel}</span>
        <span className="mb-status-divider" />
        <span>Block {blockNumber != null ? `#${blockNumber.toLocaleString()}` : '...'}</span>
        <span className="mb-status-divider" />
        <span>Gas {gasPrice != null ? `${Number(gasPrice).toFixed(1)} gwei` : '...'}</span>
      </div>
      <div className="mb-statusbar-right">
        {isConnected ? (
          <span style={{ fontFamily: 'var(--mb-font-mono)', fontSize: 11 }}>
            {displayAddress}
          </span>
        ) : (
          <button
            className="mb-btn mb-btn-ghost mb-btn-sm"
            onClick={connect}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
