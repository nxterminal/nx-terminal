import { useState } from 'react';
import { MARKETS, CATEGORIES, CATEGORY_COLORS } from '../constants';
import MarketCard from '../components/MarketCard';

export default function ActiveMarkets({ selectedMarket, onSelectMarket }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? MARKETS
    : MARKETS.filter(m => m.category === activeFilter);

  return (
    <>
      <div className="phares-toolbar">
        <span className="phares-toolbar-title">Open Markets</span>
        <div className="phares-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`phares-filter-btn ${activeFilter === cat ? 'phares-filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {filtered.map(market => (
        <MarketCard
          key={market.id}
          market={market}
          isSelected={selectedMarket?.id === market.id}
          onSelect={onSelectMarket}
        />
      ))}
      {filtered.length === 0 && (
        <div className="phares-empty">No markets in this category</div>
      )}
    </>
  );
}
