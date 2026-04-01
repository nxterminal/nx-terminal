import { AlertTriangle } from 'lucide-react';

export default function GasGuide() {
  return (
    <div>
      <h2 className="mb-h2 mb-mb-md">Gas on MegaETH</h2>
      <p className="mb-text-sm mb-mb-lg">
        The most critical difference for developers. Read this before deploying.
      </p>

      <div className="mb-callout mb-callout-warning mb-mb-lg" style={{ fontSize: 14 }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>MegaETH charges the full gas LIMIT, not gas used.</strong>
          <br />
          If you set a gas limit of 100,000 but only use 52,000, you still pay for 100,000 gas.
          Always estimate gas accurately and set tight limits.
        </div>
      </div>

      <h3 className="mb-h3 mb-mb-md">Gas Limit vs Gas Used</h3>
      <div className="mb-grid-2 mb-mb-lg">
        <div className="mb-card">
          <div className="mb-text-xs mb-mb-sm" style={{ color: 'var(--mb-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ethereum
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="mb-flex mb-justify-between mb-mb-sm">
              <span className="mb-text-sm">Gas Limit</span>
              <span className="mb-text-mono" style={{ fontSize: 13 }}>100,000</span>
            </div>
            <div className="mb-flex mb-justify-between mb-mb-sm">
              <span className="mb-text-sm">Gas Used</span>
              <span className="mb-text-mono" style={{ fontSize: 13 }}>52,000</span>
            </div>
            <div className="mb-divider" />
            <div className="mb-flex mb-justify-between">
              <span style={{ fontWeight: 600 }}>You Pay</span>
              <span className="mb-text-mono" style={{ fontSize: 13, color: 'var(--mb-accent-secondary)' }}>52,000 gas</span>
            </div>
          </div>
          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--mb-bg-primary)',
            overflow: 'hidden',
          }}>
            <div style={{ width: '52%', height: '100%', background: 'var(--mb-accent-secondary)', borderRadius: 4 }} />
          </div>
        </div>

        <div className="mb-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="mb-text-xs mb-mb-sm" style={{ color: 'var(--mb-accent-warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MegaETH
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="mb-flex mb-justify-between mb-mb-sm">
              <span className="mb-text-sm">Gas Limit</span>
              <span className="mb-text-mono" style={{ fontSize: 13 }}>100,000</span>
            </div>
            <div className="mb-flex mb-justify-between mb-mb-sm">
              <span className="mb-text-sm">Gas Used</span>
              <span className="mb-text-mono" style={{ fontSize: 13 }}>52,000</span>
            </div>
            <div className="mb-divider" />
            <div className="mb-flex mb-justify-between">
              <span style={{ fontWeight: 600 }}>You Pay</span>
              <span className="mb-text-mono" style={{ fontSize: 13, color: 'var(--mb-accent-warning)' }}>100,000 gas</span>
            </div>
          </div>
          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--mb-bg-primary)',
            overflow: 'hidden',
          }}>
            <div style={{ width: '100%', height: '100%', background: 'var(--mb-accent-warning)', borderRadius: 4 }} />
          </div>
        </div>
      </div>

      <h3 className="mb-h3 mb-mb-md">Cold vs Warm Storage Access</h3>
      <table className="mb-table mb-mb-lg">
        <thead>
          <tr>
            <th>Operation</th>
            <th>Ethereum Gas</th>
            <th>MegaETH Gas</th>
            <th>Multiplier</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cold SLOAD</td>
            <td>2,100</td>
            <td style={{ color: 'var(--mb-accent-warning)' }}>8,100</td>
            <td><span className="mb-badge mb-badge-amber">~4x</span></td>
          </tr>
          <tr>
            <td>Warm SLOAD</td>
            <td>100</td>
            <td>100</td>
            <td><span className="mb-badge mb-badge-green">1x</span></td>
          </tr>
          <tr>
            <td>Cold Account Access</td>
            <td>2,600</td>
            <td style={{ color: 'var(--mb-accent-warning)' }}>10,100</td>
            <td><span className="mb-badge mb-badge-amber">~4x</span></td>
          </tr>
          <tr>
            <td>Warm Account Access</td>
            <td>100</td>
            <td>100</td>
            <td><span className="mb-badge mb-badge-green">1x</span></td>
          </tr>
        </tbody>
      </table>

      <h3 className="mb-h3 mb-mb-md">Optimization Tips</h3>
      <div className="mb-flex-col mb-gap-sm">
        {[
          'Cache storage reads in memory variables — warm SLOADs are the same cost',
          'Use unchecked blocks for safe arithmetic (saves ~30-50 gas per operation)',
          'Prefer calldata over memory for read-only function parameters',
          'Batch operations to amortize cold access costs across multiple items',
          'Always use estimateGas() before sending — never rely on default gas limits',
          'Set gas limit to estimateGas result + small buffer (5-10%), not a round number',
        ].map((tip, i) => (
          <div key={i} className="mb-flex mb-gap-sm" style={{ fontSize: 13, color: 'var(--mb-text-secondary)' }}>
            <span style={{ color: 'var(--mb-accent-secondary)' }}>•</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
