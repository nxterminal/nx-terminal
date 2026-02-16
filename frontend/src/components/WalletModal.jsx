import { IconWallet } from './icons';

const WALLETS = [
  {
    name: 'MetaMask',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,1 18,5 18,13 10,19 2,13 2,5" fill="#f6851b" stroke="#c45a1b" strokeWidth="0.5"/>
        <polygon points="10,4 14,7 14,11 10,14 6,11 6,7" fill="#e2761b"/>
        <rect x="8" y="8" width="4" height="3" fill="#763e1a"/>
      </svg>
    ),
    desc: 'Browser extension wallet',
  },
  {
    name: 'WalletConnect',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" fill="#3b99fc" stroke="#2070c0" strokeWidth="0.5"/>
        <path d="M5 9 Q10 5 15 9" stroke="#fff" strokeWidth="1.5" fill="none"/>
        <path d="M7 11 Q10 8 13 11" stroke="#fff" strokeWidth="1" fill="none"/>
      </svg>
    ),
    desc: 'Scan with mobile wallet',
  },
  {
    name: 'Rainbow',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14 Q3 3 17 14" stroke="#ff0000" strokeWidth="1.5" fill="none"/>
        <path d="M5 14 Q5 5 15 14" stroke="#ffaa00" strokeWidth="1.5" fill="none"/>
        <path d="M7 14 Q7 7 13 14" stroke="#00cc00" strokeWidth="1.5" fill="none"/>
        <path d="M9 14 Q9 9 11 14" stroke="#0066ff" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    desc: 'Mobile-first wallet',
  },
];

export default function WalletModal({ onClose, onConnect }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-win98" onClick={e => e.stopPropagation()}>
        <div className="win98-titlebar" style={{ cursor: 'default' }}>
          <span className="win98-titlebar-icon"><IconWallet size={16} /></span>
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
                <span>{w.icon}</span>
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
