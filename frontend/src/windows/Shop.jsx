import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

const EMPLOYEE_PERKS = [
  { name: 'Energy Drink', icon: '\u26A1', desc: 'Restore 3 energy to a dev', cost: 500 },
  { name: 'Rubber Duck', icon: '\u{1F986}', desc: 'Debug bonus: +10% code quality', cost: 750 },
  { name: 'Coffee IV', icon: '\u2615', desc: 'Max energy for 1 cycle', cost: 1200 },
  { name: 'AI Copilot', icon: '\u{1F916}', desc: '+25% coding speed for 3 cycles', cost: 2000 },
];

const BLACK_MARKET = [
  { name: 'DDoS Attack', icon: '\u{1F4A5}', desc: 'Slow rival protocol for 2 cycles', cost: 3000 },
  { name: 'Bug Inject', icon: '\u{1F41B}', desc: 'Plant bugs in rival code (-20% quality)', cost: 2500 },
  { name: 'Steal Repo', icon: '\u{1F977}', desc: 'Copy rival protocol at 50% value', cost: 5000 },
  { name: 'Transmogrify', icon: '\u{1F52E}', desc: 'Randomize a dev archetype', cost: 4000 },
];

export default function Shop() {
  const [apiItems, setApiItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getShop()
      .then(d => setApiItems(Array.isArray(d) ? d : d.items || d.shop || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading shop...</div>;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{
        padding: '6px 8px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-amber)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        textAlign: 'center',
      }}>
        {'>> COMPANY STORE << Connect wallet to purchase items'}
      </div>

      {/* Employee Perks Section */}
      <div className="shop-section-header green">Employee Perks</div>
      <div className="shop-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {EMPLOYEE_PERKS.map((item, i) => (
          <div key={`perk-${i}`} className="shop-card win-raised">
            <div className="shop-card-icon">{item.icon}</div>
            <div className="shop-card-name">{item.name}</div>
            <div className="shop-card-desc">{item.desc}</div>
            <div className="shop-card-cost">{formatNumber(item.cost)} $NXT</div>
            <button className="win-btn" disabled style={{ fontSize: '10px', marginTop: '4px' }}>
              Buy (Connect Wallet)
            </button>
          </div>
        ))}
      </div>

      {/* Black Market Section */}
      <div className="shop-section-header red">Black Market</div>
      <div className="shop-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {BLACK_MARKET.map((item, i) => (
          <div key={`bm-${i}`} className="shop-card win-raised black-market">
            <div className="shop-card-icon">{item.icon}</div>
            <div className="shop-card-name" style={{ color: 'var(--terminal-red)' }}>{item.name}</div>
            <div className="shop-card-desc">{item.desc}</div>
            <div className="shop-card-cost">{formatNumber(item.cost)} $NXT</div>
            <button className="win-btn" disabled style={{ fontSize: '10px', marginTop: '4px' }}>
              Buy (Connect Wallet)
            </button>
          </div>
        ))}
      </div>

      {/* API items if any */}
      {apiItems.length > 0 && (
        <>
          <div className="shop-section-header green">Special Offers</div>
          <div className="shop-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {apiItems.map((item, i) => (
              <div key={`api-${i}`} className="shop-card win-raised">
                <div className="shop-card-icon">{'\u{1F4E6}'}</div>
                <div className="shop-card-name">{item.name}</div>
                <div className="shop-card-desc">{item.description}</div>
                <div className="shop-card-cost">{formatNumber(item.cost_nxt || item.cost)} $NXT</div>
                <button className="win-btn" disabled style={{ fontSize: '10px', marginTop: '4px' }}>
                  Buy (Connect Wallet)
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
