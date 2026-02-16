import { useState } from 'react';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function CollectSalary({ wallet }) {
  const [pct, setPct] = useState(100);

  const totalAccrued = 12450;
  const devCount = 5;
  const salaryPortion = 8000;
  const tradingPortion = 4450;
  const collectAmount = Math.floor(totalAccrued * pct / 100);
  const tax = Math.floor(collectAmount * 0.1);
  const netAmount = collectAmount - tax;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div className="gold-box" style={{ textAlign: 'center', margin: '12px' }}>
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>YOUR ACCRUED COMPENSATION</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
          {formatNumber(totalAccrued)} $NXT
        </div>
        <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--terminal-amber)' }}>
          From {devCount} devs | Salary: {formatNumber(salaryPortion)} + Trading: +{formatNumber(tradingPortion)}
        </div>
      </div>

      <div style={{ padding: '0 12px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', marginBottom: '8px' }}>Select amount to collect:</div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
          {[25, 50, 75, 100].map(p => (
            <button
              key={p}
              className={`win-btn${pct === p ? ' primary' : ''}`}
              onClick={() => setPct(p)}
              style={{ padding: '4px 12px' }}
            >
              {p === 100 ? 'MAX' : `${p}%`}
            </button>
          ))}
        </div>

        <div className="win-panel" style={{ padding: '12px', margin: '0 auto', maxWidth: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Collecting:</span>
            <span style={{ fontWeight: 'bold' }}>{formatNumber(collectAmount)} $NXT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Tax (10%):</span>
            <span style={{ color: 'var(--terminal-red)' }}>-{formatNumber(tax)} $NXT</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-dark)',
            paddingTop: '4px',
            fontWeight: 'bold',
          }}>
            <span>Net:</span>
            <span style={{ color: 'var(--gold)' }}>{formatNumber(netAmount)} $NXT</span>
          </div>
        </div>

        <button
          className="win-btn primary"
          disabled={!wallet}
          style={{ marginTop: '16px', padding: '6px 24px' }}
        >
          {wallet ? 'Cash Out to Wallet' : 'Connect Wallet to Cash Out'}
        </button>
      </div>

      <div className="red-box" style={{ margin: '12px' }}>
        HR Notice: Collected $NXT leaves your in-game balance and is sent to your wallet.
        Your devs will continue earning new $NXT after collection.
      </div>
    </div>
  );
}
