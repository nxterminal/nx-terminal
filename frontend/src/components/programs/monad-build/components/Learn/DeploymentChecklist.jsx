import { useState } from 'react';
import { Check } from 'lucide-react';

const ITEMS = [
  { text: 'Solidity evmVersion set to "prague"', critical: true },
  { text: 'Gas limits tested and optimized (MegaETH charges full limit)', critical: true },
  { text: 'Cold storage access patterns optimized (8,100 gas per cold SLOAD)', critical: false },
  { text: 'Contract size under 128 KB (MegaETH limit)', critical: false },
  { text: 'Tested on MegaETH (Chain ID 4326)', critical: true },
  { text: 'Wallet funded with ETH for deployment gas', critical: true },
  { text: 'Contract verified on MegaExplorer', critical: false },
  { text: 'Access control configured (Ownable or AccessControl)', critical: false },
  { text: 'Events emitted for all important state changes', critical: false },
  { text: 'Re-entrancy guards on external calls', critical: true },
];

export default function DeploymentChecklist() {
  const [checked, setChecked] = useState({});

  function toggle(i) {
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <h2 className="mb-h2 mb-mb-sm">Pre-Deployment Checklist</h2>
      <p className="mb-text-sm mb-mb-md">
        {checkedCount}/{ITEMS.length} completed — verify everything before going to mainnet.
      </p>

      <div style={{
        height: 4,
        background: 'var(--mb-bg-tertiary)',
        borderRadius: 2,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(checkedCount / ITEMS.length) * 100}%`,
          height: '100%',
          background: checkedCount === ITEMS.length
            ? 'var(--mb-accent-secondary)'
            : 'var(--mb-accent-primary)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div className="mb-flex-col mb-gap-sm">
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className={`mb-checkbox ${checked[i] ? 'checked' : ''}`}
            onClick={() => toggle(i)}
          >
            <div className="mb-checkbox-box">
              {checked[i] && <Check size={12} style={{ color: 'white' }} />}
            </div>
            <span>
              {item.text}
              {item.critical && (
                <span className="mb-badge mb-badge-red" style={{ marginLeft: 8 }}>Critical</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
