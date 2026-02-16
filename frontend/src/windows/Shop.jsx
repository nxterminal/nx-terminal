import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { IconFolder } from '../components/icons';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

const EMPLOYEE_PERKS = [
  { name: 'Energy Drink', icon: <svg width="20" height="20" viewBox="0 0 20 20"><rect x="6" y="2" width="8" height="16" rx="1" fill="#33aa33" stroke="#006600" strokeWidth="0.5"/><rect x="7" y="4" width="6" height="3" fill="#ffcc00"/><path d="M15 6 L17 4 L17 8 L15 10" stroke="#ffcc00" strokeWidth="1" fill="none"/></svg>, desc: 'Restore 3 energy to a dev', cost: 500 },
  { name: 'Rubber Duck', icon: <svg width="20" height="20" viewBox="0 0 20 20"><ellipse cx="10" cy="13" rx="7" ry="5" fill="#ffdd00" stroke="#cc9900" strokeWidth="0.5"/><circle cx="8" cy="8" r="4" fill="#ffdd00" stroke="#cc9900" strokeWidth="0.5"/><circle cx="7" cy="7" r="1" fill="#000"/><polygon points="10,8 13,9 10,10" fill="#ff8800"/></svg>, desc: 'Debug bonus: +10% code quality', cost: 750 },
  { name: 'Coffee IV', icon: <svg width="20" height="20" viewBox="0 0 20 20"><rect x="5" y="4" width="8" height="12" rx="1" fill="#8B6914" stroke="#5a4010" strokeWidth="0.5"/><rect x="13" y="6" width="3" height="6" rx="1" fill="none" stroke="#5a4010" strokeWidth="0.5"/><path d="M6 5 Q8 2 12 5" stroke="#888" strokeWidth="0.5" fill="none"/><path d="M8 4 Q9 1 10 4" stroke="#888" strokeWidth="0.5" fill="none"/></svg>, desc: 'Max energy for 1 cycle', cost: 1200 },
  { name: 'AI Copilot', icon: <svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="6" width="12" height="10" rx="1" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/><rect x="7" y="8" width="2" height="2" rx="0.5" fill="#000080"/><rect x="11" y="8" width="2" height="2" rx="0.5" fill="#000080"/><rect x="8" y="12" width="4" height="1" fill="#808080"/><line x1="10" y1="3" x2="10" y2="6" stroke="#808080" strokeWidth="1"/><circle cx="10" cy="2" r="1.5" fill="#ff0000"/></svg>, desc: '+25% coding speed for 3 cycles', cost: 2000 },
];

const BLACK_MARKET = [
  { name: 'DDoS Attack', icon: <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#ff4444" strokeWidth="1"/><circle cx="10" cy="10" r="4" fill="none" stroke="#ff4444" strokeWidth="1"/><circle cx="10" cy="10" r="1.5" fill="#ff4444"/><line x1="10" y1="1" x2="10" y2="5" stroke="#ff4444" strokeWidth="1"/><line x1="15" y1="3" x2="13" y2="6" stroke="#ff4444" strokeWidth="1"/></svg>, desc: 'Slow rival protocol for 2 cycles', cost: 3000 },
  { name: 'Bug Inject', icon: <svg width="20" height="20" viewBox="0 0 20 20"><ellipse cx="10" cy="12" rx="5" ry="6" fill="#33aa33" stroke="#006600" strokeWidth="0.5"/><circle cx="10" cy="6" r="3" fill="#33aa33" stroke="#006600" strokeWidth="0.5"/><line x1="5" y1="9" x2="2" y2="7" stroke="#006600" strokeWidth="0.7"/><line x1="15" y1="9" x2="18" y2="7" stroke="#006600" strokeWidth="0.7"/><line x1="5" y1="13" x2="2" y2="14" stroke="#006600" strokeWidth="0.7"/><line x1="15" y1="13" x2="18" y2="14" stroke="#006600" strokeWidth="0.7"/></svg>, desc: 'Plant bugs in rival code (-20% quality)', cost: 2500 },
  { name: 'Steal Repo', icon: <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="5" width="14" height="11" rx="0.5" fill="#333" stroke="#000" strokeWidth="0.5"/><rect x="8" y="1" width="4" height="5" rx="0.5" fill="none" stroke="#888" strokeWidth="1"/><circle cx="10" cy="10" r="2" fill="#ffcc00"/><rect x="9.5" y="10" width="1" height="3" fill="#ffcc00"/></svg>, desc: 'Copy rival protocol at 50% value', cost: 5000 },
  { name: 'Transmogrify', icon: <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#6600cc" stroke="#330066" strokeWidth="0.5"/><circle cx="10" cy="10" r="3" fill="#9933ff"/><circle cx="10" cy="10" r="1" fill="#fff"/><path d="M5 5 L7 7" stroke="#cc99ff" strokeWidth="0.5"/><path d="M15 5 L13 7" stroke="#cc99ff" strokeWidth="0.5"/><path d="M10 2 L10 4" stroke="#cc99ff" strokeWidth="0.5"/></svg>, desc: 'Randomize a dev archetype', cost: 4000 },
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

      {apiItems.length > 0 && (
        <>
          <div className="shop-section-header green">Special Offers</div>
          <div className="shop-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {apiItems.map((item, i) => (
              <div key={`api-${i}`} className="shop-card win-raised">
                <div className="shop-card-icon"><IconFolder size={20} /></div>
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
