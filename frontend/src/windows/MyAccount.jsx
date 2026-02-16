import { useWallet } from '../contexts/WalletContext';

export default function MyAccount() {
  const { connected, wallet, truncated, connect, disconnect } = useWallet();

  return (
    <div style={{ padding: '12px', overflow: 'auto', height: '100%', fontSize: '11px' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '48px' }}>👤</div>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>
          {connected ? 'Operator Profile' : 'Not Connected'}
        </div>
      </div>

      <div className="win-panel" style={{ padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Wallet Connection
        </div>
        {connected ? (
          <>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#666' }}>Address: </span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '10px' }}>{wallet}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#666' }}>Status: </span>
              <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>CONNECTED</span>
            </div>
            <button className="win-btn" onClick={disconnect}>Disconnect Wallet</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '8px', color: 'var(--terminal-red)' }}>No wallet connected</div>
            <button className="win-btn" onClick={connect}>Connect Wallet</button>
          </>
        )}
      </div>

      <div className="win-panel" style={{ padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Account Stats
        </div>
        <table style={{ width: '100%' }}>
          <tbody>
            {[
              ['Operator Level', connected ? '7' : '-'],
              ['Total Devs Owned', connected ? '4' : '-'],
              ['$NXT Balance', connected ? '12,450' : '-'],
              ['Protocols Invested', connected ? '3' : '-'],
              ['Total Earnings', connected ? '48,200 $NXT' : '-'],
              ['Member Since', connected ? 'Cycle 1' : '-'],
              ['Reputation Score', connected ? '847' : '-'],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ color: '#666', padding: '2px 8px 2px 0' }}>{label}:</td>
                <td style={{ fontWeight: 'bold' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="win-panel" style={{ padding: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Achievements
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            ['🏆', 'First Blood'], ['💰', 'Money Maker'], ['🎮', 'Game On'],
            ['📊', 'Data Miner'], ['🔒', '???'], ['🔒', '???'],
          ].map(([icon, label], i) => (
            <div key={i} className="win-raised" style={{ padding: '6px 10px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '20px' }}>{icon}</div>
              <div style={{ fontSize: '9px', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
