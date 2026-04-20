import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';

// Mirrors backend/api/routes/admin.py::ADMIN_WALLETS. Same set Inbox.jsx
// uses for the Support Tickets admin tab. Backend remains source of truth
// (non-admin wallets get 403); the client mirror just hides admin-only UI.
const NXMARKET_ADMIN_WALLETS = new Set([
  '0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc',
  '0xae882a8933b33429f53b7cee102ef3dbf9c9e88b',
]);

export function isNxMarketAdmin(wallet) {
  return !!wallet && NXMARKET_ADMIN_WALLETS.has(wallet.toLowerCase());
}


function HelpModal({ onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10010,
    }}>
      <div onClick={e => e.stopPropagation()} className="win-raised" style={{
        width: 480, background: 'var(--win-bg, #c0c0c0)',
        fontFamily: "'VT323', monospace",
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>What is NXMARKET?</span>
          <button onClick={onClose} className="win-btn"
            style={{ padding: '0 4px', fontWeight: 'bold' }}>X</button>
        </div>
        <div style={{ padding: 14, fontSize: 'var(--text-base)', lineHeight: 1.5 }}>
          <p>
            <b>NXMARKET</b> is a prediction market. Bet $NXT on whether
            future events resolve YES or NO.
          </p>
          <p style={{ marginTop: 10 }}>
            <b>Trading.</b> Each market has a YES side and a NO side.
            Prices auto-balance via LMSR — buying YES pushes the YES
            price up. You can exit any time before resolution (3% penalty).
          </p>
          <p style={{ marginTop: 10 }}>
            <b>Resolution.</b> When the market closes, an admin declares
            the winning side. Winners split the pool proportional to
            shares held. Losers get 0.
          </p>
          <p style={{ marginTop: 10 }}>
            <b>Creating a market.</b> Costs 500 $NXT. The creator earns a
            5% commission of the pool when the market resolves.
          </p>
          <div style={{ textAlign: 'right', marginTop: 14 }}>
            <button onClick={onClose} className="win-btn"
              style={{ padding: '4px 14px' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function NXMarket() {
  const { address: wallet } = useWallet();
  const [tab, setTab] = useState('markets');
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
      background: 'var(--win-bg, #c0c0c0)',
    }}>
      {/* Tab strip */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #808080',
        background: 'var(--win-bg, #c0c0c0)',
      }}>
        {[
          { id: 'markets', label: 'Markets' },
          { id: 'positions', label: 'My Positions' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className="win-btn"
            style={{
              padding: '6px 14px', fontWeight: tab === t.id ? 'bold' : 'normal',
              borderBottom: tab === t.id ? '2px solid #000080' : 'none',
              background: tab === t.id ? '#fff' : undefined,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
        {tab === 'markets' && (
          <div style={{
            color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60,
          }}>
            Loading markets...
          </div>
        )}
        {tab === 'positions' && (
          <div style={{
            color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60,
          }}>
            No positions yet
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #808080', padding: '4px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--win-bg, #c0c0c0)', fontSize: 'var(--text-sm)',
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {wallet
            ? `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
            : 'No wallet connected'}
        </span>
        <button onClick={() => setHelpOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#000080', textDecoration: 'underline',
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-sm)',
          }}>
          What is NXMARKET?
        </button>
      </div>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
