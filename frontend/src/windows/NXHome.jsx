import { useWallet } from '../contexts/WalletContext';

export default function NXHome() {
  const { connected, truncated } = useWallet();

  return (
    <div style={{ padding: '16px', fontFamily: "'Tahoma', sans-serif", fontSize: '11px', overflow: 'auto', height: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖥️</div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px', color: 'var(--win-title-l)', marginBottom: '4px' }}>
          NX TERMINAL
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Protocol Wars Command Center</div>
      </div>

      <div className="win-panel" style={{ padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          System Status
        </div>
        <table style={{ width: '100%', fontSize: '11px' }}>
          <tbody>
            <tr><td style={{ color: '#666', padding: '2px 8px 2px 0' }}>Network:</td><td style={{ color: 'var(--terminal-green)' }}>ONLINE</td></tr>
            <tr><td style={{ color: '#666', padding: '2px 8px 2px 0' }}>Wallet:</td><td>{connected ? <span style={{ color: 'var(--terminal-green)' }}>{truncated}</span> : <span style={{ color: 'var(--terminal-red)' }}>NOT CONNECTED</span>}</td></tr>
            <tr><td style={{ color: '#666', padding: '2px 8px 2px 0' }}>Protocol Wars:</td><td style={{ color: 'var(--terminal-amber)' }}>Season 1 Active</td></tr>
            <tr><td style={{ color: '#666', padding: '2px 8px 2px 0' }}>Server:</td><td>NX-NODE-7 (US-EAST)</td></tr>
          </tbody>
        </table>
      </div>

      <div className="win-panel" style={{ padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Quick Links
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {[
            ['📡', 'Action Feed'], ['🏆', 'Leaderboard'], ['📊', 'Protocol Market'], ['🧠', 'AI Lab'],
            ['📁', 'My Devs'], ['🛒', 'Shop'], ['📬', 'Inbox'], ['💰', 'Collect Salary'],
          ].map(([icon, label]) => (
            <div key={label} style={{ padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{icon}</span> <span style={{ textDecoration: 'underline', color: 'var(--win-title-l)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="win-panel" style={{ padding: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Announcements
        </div>
        <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '6px' }}><strong>[NEW]</strong> Protocol Wars Season 2 coming soon! Prepare your devs.</p>
          <p style={{ marginBottom: '6px' }}><strong>[UPDATE]</strong> New archetype "WHALE" detected in the network.</p>
          <p><strong>[PATCH]</strong> Bug fixes: Dev energy drain rate normalized. Trading fees adjusted.</p>
        </div>
      </div>
    </div>
  );
}
