import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

const AVAILABLE_DEVS = [
  { id: 101, name: 'ShadowCoder_X', archetype: '10X_DEV', level: 3, price: 5000, rarity: 'rare', stats: { code: 92, trade: 45, social: 30 } },
  { id: 102, name: 'MoonTrader99', archetype: 'DEGEN', level: 2, price: 2500, rarity: 'uncommon', stats: { code: 35, trade: 88, social: 60 } },
  { id: 103, name: 'Silent_Observer', archetype: 'LURKER', level: 4, price: 4000, rarity: 'rare', stats: { code: 50, trade: 55, social: 15 } },
  { id: 104, name: 'GrindMaster_7', archetype: 'GRINDER', level: 1, price: 1500, rarity: 'common', stats: { code: 60, trade: 50, social: 40 } },
  { id: 105, name: 'CryptoInfluencer', archetype: 'INFLUENCER', level: 2, price: 3000, rarity: 'uncommon', stats: { code: 20, trade: 65, social: 95 } },
  { id: 106, name: 'H4CK3R_PR1M3', archetype: 'HACKTIVIST', level: 5, price: 8000, rarity: 'legendary', stats: { code: 85, trade: 30, social: 25 } },
  { id: 107, name: 'Agent_Smith_42', archetype: 'FED', level: 3, price: 6000, rarity: 'rare', stats: { code: 55, trade: 70, social: 65 } },
  { id: 108, name: 'CopyPasta_Kid', archetype: 'SCRIPT_KIDDIE', level: 1, price: 800, rarity: 'common', stats: { code: 30, trade: 25, social: 50 } },
];

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444', 'LURKER': '#808080', 'DEGEN': '#ffd700', 'GRINDER': '#4488ff',
  'INFLUENCER': '#ff44ff', 'HACKTIVIST': '#33ff33', 'FED': '#ffaa00', 'SCRIPT_KIDDIE': '#00ffff',
};

export default function HireDevs() {
  const { connected } = useWallet();
  const [hired, setHired] = useState({});

  const handleHire = (dev) => {
    if (!connected) return;
    setHired(prev => ({ ...prev, [dev.id]: true }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 8px', background: 'var(--win-bg)', borderBottom: '1px solid var(--border-dark)', fontSize: '11px' }}>
        Hire Devs / Mint — {connected ? 'Select a dev to hire' : '⚠️ Connect wallet to hire'}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
          {AVAILABLE_DEVS.map(dev => (
            <div key={dev.id} className="win-panel" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{dev.name}</span>
                <span className={`rarity-${dev.rarity}`} style={{ fontSize: '9px' }}>({dev.rarity})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="badge" style={{ color: ARCHETYPE_COLORS[dev.archetype], fontSize: '10px' }}>{dev.archetype}</span>
                <span style={{ fontSize: '10px', color: '#666' }}>Lv.{dev.level}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '9px', marginTop: '4px' }}>
                <span title="Code">💻{dev.stats.code}</span>
                <span title="Trade">📈{dev.stats.trade}</span>
                <span title="Social">💬{dev.stats.social}</span>
              </div>
              <div style={{ fontWeight: 'bold', color: 'var(--gold)', fontSize: '12px', marginTop: '4px' }}>
                {dev.price.toLocaleString()} $NXT
              </div>
              <button className="win-btn"
                disabled={!connected || hired[dev.id]}
                onClick={() => handleHire(dev)}
                style={{ fontSize: '10px', marginTop: '4px' }}>
                {hired[dev.id] ? '✓ Hired!' : connected ? 'Hire Dev' : 'Connect Wallet'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
