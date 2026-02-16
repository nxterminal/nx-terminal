import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

const ITEM_ICONS = {
  'energy': '\u26A1',
  'boost': '\u{1F680}',
  'shield': '\u{1F6E1}',
  'hack': '\u{1F4BB}',
  'potion': '\u{1F9EA}',
  'scroll': '\u{1F4DC}',
  'default': '\u{1F4E6}',
};

function getItemIcon(item) {
  const name = (item.name || '').toLowerCase();
  for (const [key, icon] of Object.entries(ITEM_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return ITEM_ICONS.default;
}

export default function Shop() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getShop()
      .then(d => {
        setItems(Array.isArray(d) ? d : d.items || d.shop || []);
      })
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
        {'>> NXT SHOP << Connect wallet to purchase items'}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--border-dark)' }}>
          Shop is empty. Check back later!
        </div>
      ) : (
        <div className="shop-grid">
          {items.map((item, i) => (
            <div key={item.id || i} className="shop-card win-raised">
              <div className="shop-card-icon">{getItemIcon(item)}</div>
              <div className="shop-card-name">{item.name}</div>
              <div className="shop-card-desc">{item.description}</div>
              <div className="shop-card-cost">{formatNumber(item.cost_nxt || item.cost)} $NXT</div>
              <button className="win-btn" disabled style={{ fontSize: '10px', marginTop: '4px' }}>
                Buy (Connect Wallet)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
