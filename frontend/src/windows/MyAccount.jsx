import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function MyAccount({ wallet, openWindow }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wallet) {
      api.getPlayer(wallet)
        .then(d => setPlayer(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [wallet]);

  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ color: 'var(--gold)', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px' }}>
        EMPLOYEE DASHBOARD
      </div>

      {!wallet ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: 'var(--terminal-amber)', marginBottom: '12px' }}>
            {'> Wallet not connected'}
          </div>
          <div style={{ color: '#aaa', marginBottom: '16px' }}>
            Connect your wallet to view your employee dashboard.
          </div>
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Using placeholder data...
          </div>
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--terminal-amber)', textAlign: 'center', padding: '20px' }}>
          Loading account data...
        </div>
      ) : null}

      <div style={{ padding: '0 8px', lineHeight: '2' }}>
        <div>
          <span style={{ color: 'var(--terminal-cyan)' }}>Wallet:</span>{' '}
          <span style={{ color: 'var(--terminal-green)' }}>
            {wallet || '0x0000...0000 (not connected)'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--terminal-cyan)' }}>Corporation:</span>{' '}
          <span style={{ color: 'var(--gold)' }}>
            {player?.corporation || 'Unassigned'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--terminal-cyan)' }}>Total Devs:</span>{' '}
          <span>{player?.dev_count || 0}</span>
        </div>
        <div>
          <span style={{ color: 'var(--terminal-cyan)' }}>Total $NXT Accrued:</span>{' '}
          <span style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: '16px' }}>
            {formatNumber(player?.total_nxt || 0)}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          className="win-btn primary"
          onClick={() => openWindow?.('collect-salary')}
          style={{ padding: '8px 24px', fontSize: '13px' }}
        >
          Collect Salary
        </button>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '8px',
        borderTop: '1px solid #333',
        color: '#666',
        fontSize: '12px',
        textAlign: 'center',
      }}>
        Employee ID: {wallet ? wallet.slice(0, 10) : 'N/A'} | Status: Active
      </div>
    </div>
  );
}
