import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MEGAETH_KEY_DIFFERENCES } from '../../constants/monad';
import Badge from '../shared/Badge';

const CODE_EXAMPLES = {
  'Cold SLOAD': {
    bad: `// Expensive on MegaETH (8,100 gas per cold SLOAD)
function getBalance(address user) public view returns (uint256) {
    return balances[user]; // Cold read every call
}`,
    good: `// Optimized: cache in memory
function processBalances(address[] calldata users)
    public view returns (uint256 total)
{
    uint256 len = users.length;
    for (uint256 i; i < len;) {
        total += balances[users[i]];
        unchecked { ++i; }
    }
}`,
  },
  'Gas Charging': {
    bad: `// On MegaETH, you pay for the full gas LIMIT
// Gas limit: 100,000 | Gas used: 52,000
// Ethereum charges: 52,000 gas
// MegaETH charges:   100,000 gas`,
    good: `// Always estimate gas and set tight limits
const gasEstimate = await publicClient.estimateGas({...});
const tx = await walletClient.sendTransaction({
    ...txParams,
    gas: gasEstimate, // Use the estimate, not a high default
});`,
  },
  'EVM Version': {
    bad: `// Missing evmVersion — may fail on MegaETH
// hardhat.config.js
module.exports = {
    solidity: "0.8.28",
};`,
    good: `// Correct: set evmVersion to "prague"
// hardhat.config.js
module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            evmVersion: "prague",
            optimizer: { enabled: true, runs: 200 },
        },
    },
};`,
  },
};

export default function InteractiveComparison() {
  const [expanded, setExpanded] = useState({});

  function toggle(aspect) {
    setExpanded(prev => ({ ...prev, [aspect]: !prev[aspect] }));
  }

  const severityColor = {
    good: 'green',
    warning: 'amber',
    info: 'blue',
  };

  return (
    <div>
      <h2 className="mb-h2 mb-mb-md">MegaETH vs Ethereum</h2>
      <p className="mb-text-sm mb-mb-lg">
        Key differences every developer should know. Click rows for details.
      </p>

      <table className="mb-table">
        <thead>
          <tr>
            <th>Aspect</th>
            <th>Ethereum</th>
            <th>MegaETH</th>
            <th>Developer Impact</th>
          </tr>
        </thead>
        <tbody>
          {MEGAETH_KEY_DIFFERENCES.map(d => (
            <>
              <tr
                key={d.aspect}
                onClick={() => CODE_EXAMPLES[d.aspect] && toggle(d.aspect)}
                style={{ cursor: CODE_EXAMPLES[d.aspect] ? 'pointer' : 'default' }}
              >
                <td style={{ fontWeight: 500, color: 'var(--mb-text-primary)' }}>
                  <span className="mb-flex mb-items-center mb-gap-sm">
                    {d.aspect}
                    {CODE_EXAMPLES[d.aspect] && (
                      expanded[d.aspect]
                        ? <ChevronUp size={14} style={{ color: 'var(--mb-text-tertiary)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--mb-text-tertiary)' }} />
                    )}
                  </span>
                </td>
                <td>{d.ethereum}</td>
                <td>
                  <Badge color={severityColor[d.severity]}>{d.megaeth}</Badge>
                </td>
                <td style={{ fontSize: 12 }}>{d.impact}</td>
              </tr>
              {expanded[d.aspect] && CODE_EXAMPLES[d.aspect] && (
                <tr key={`${d.aspect}-detail`}>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <div className="mb-animate-in" style={{ display: 'flex', gap: 12, padding: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div className="mb-text-xs mb-mb-sm" style={{ color: 'var(--mb-accent-error)' }}>
                          Before (suboptimal)
                        </div>
                        <pre className="mb-code-block" style={{ margin: 0, fontSize: 12 }}>
                          {CODE_EXAMPLES[d.aspect].bad}
                        </pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="mb-text-xs mb-mb-sm" style={{ color: 'var(--mb-accent-secondary)' }}>
                          After (optimized)
                        </div>
                        <pre className="mb-code-block" style={{ margin: 0, fontSize: 12 }}>
                          {CODE_EXAMPLES[d.aspect].good}
                        </pre>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
