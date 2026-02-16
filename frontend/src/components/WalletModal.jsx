const WALLETS = [
  { name: 'MetaMask', icon: '\u{1F98A}', desc: 'Browser extension wallet' },
  { name: 'WalletConnect', icon: '\u{1F517}', desc: 'Scan with mobile wallet' },
  { name: 'Rainbow', icon: '\u{1F308}', desc: 'Mobile-first wallet' },
];

export default function WalletModal({ onClose, onConnect }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-win98" onClick={e => e.stopPropagation()}>
        <div className="win98-titlebar" style={{ cursor: 'default' }}>
          <span className="win98-titlebar-icon">{'\u{1F4B3}'}</span>
          <span className="win98-titlebar-title">Connect Wallet</span>
          <div className="win98-titlebar-buttons">
            <button className="win98-titlebar-btn" onClick={onClose}>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>x</span>
            </button>
          </div>
        </div>
        <div style={{ padding: '12px' }}>
          <p style={{ fontSize: '11px', marginBottom: '12px' }}>
            Select a wallet provider to connect:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {WALLETS.map(w => (
              <button
                key={w.name}
                className="win-btn"
                onClick={() => onConnect(w.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '20px' }}>{w.icon}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{w.name}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>{w.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <button className="win-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
