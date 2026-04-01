import { ExternalLink } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import { MEGAETH_MAINNET } from '../../constants/monad';

export default function VerifyContract() {
  const { state } = useBuild();

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Verify Contract</h3>
      <p className="mb-text-sm mb-mb-md">
        Verify your contract source code on MegaETH block explorers for transparency.
      </p>

      <div className="mb-card mb-mb-md">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>MegaETHScan</div>
        <div className="mb-text-sm mb-mb-sm">
          Upload your source code and metadata to verify via MegaETHScan verification.
        </div>
        <a
          href={`${MEGAETH_MAINNET.explorer}/address/${state.deployedAddress || ''}#code`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-btn mb-btn-secondary mb-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          Verify on MegaETHScan <ExternalLink size={12} />
        </a>
      </div>

      <div className="mb-callout mb-callout-info">
        <div>
          <strong>Compiler settings must match exactly:</strong>
          <br />
          Solidity ^0.8.28, evmVersion: "prague", optimizer: enabled (200 runs)
        </div>
      </div>
    </div>
  );
}
