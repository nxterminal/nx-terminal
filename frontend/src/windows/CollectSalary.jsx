import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useDevs } from '../contexts/DevsContext';

export default function CollectSalary() {
  const { connected } = useWallet();
  const { devs, totalSalary } = useDevs();
  const [collected, setCollected] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const baseSalary = 1000;
  const devBonus = totalSalary;
  const total = baseSalary + devBonus;

  useEffect(() => {
    if (collected) {
      setCountdown(120);
      const id = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(id); setCollected(false); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [collected]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ padding: '24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>💰</div>
      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Collect Salary</div>

      {!connected ? (
        <div style={{ color: 'var(--terminal-red)', fontSize: '12px' }}>
          Connect your wallet to collect salary
        </div>
      ) : collected ? (
        <>
          <div style={{ color: 'var(--terminal-green)', fontSize: '14px', fontWeight: 'bold' }}>
            Salary Collected! +{total} $NXT
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            Next collection available in: <strong>{formatTime(countdown)}</strong>
          </div>
          <div className="win-panel" style={{ padding: '8px', width: '200px' }}>
            <div style={{ height: '12px', background: '#000', border: '1px solid var(--border-dark)' }}>
              <div style={{ width: `${((120 - countdown) / 120) * 100}%`, height: '100%', background: 'var(--terminal-green)', transition: 'width 1s linear' }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="win-panel" style={{ padding: '16px', width: '250px' }}>
            <table style={{ width: '100%', fontSize: '12px' }}>
              <tbody>
                <tr><td style={{ color: '#666', textAlign: 'left' }}>Base Salary:</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{baseSalary} $NXT</td></tr>
                <tr><td style={{ color: '#666', textAlign: 'left' }}>Dev Bonus ({devs.length} devs):</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--terminal-green)' }}>+{devBonus} $NXT</td></tr>
                <tr><td colSpan={2}><hr style={{ border: 'none', borderTop: '1px solid var(--border-dark)', margin: '4px 0' }} /></td></tr>
                <tr><td style={{ color: '#666', textAlign: 'left' }}>Total:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--gold)', fontSize: '14px' }}>{total} $NXT</td></tr>
              </tbody>
            </table>
          </div>
          <button className="win-btn" onClick={() => setCollected(true)} style={{ padding: '6px 24px', fontSize: '12px', fontWeight: 'bold' }}>
            💰 Collect Now
          </button>
        </>
      )}
    </div>
  );
}
