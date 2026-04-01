import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ECOSYSTEM_PROTOCOLS } from '../../constants/monad';
import ProtocolCard from './ProtocolCard';

const CATEGORIES = ['all', 'defi', 'gaming', 'nft', 'infra'];

function getAllProtocols() {
  const all = [];
  Object.entries(ECOSYSTEM_PROTOCOLS).forEach(([cat, protocols]) => {
    protocols.forEach(p => all.push({ ...p, categoryKey: cat }));
  });
  return all;
}

export default function EcosystemModule() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const allProtocols = useMemo(() => getAllProtocols(), []);

  const filtered = useMemo(() => {
    let result = allProtocols;
    if (activeCategory !== 'all') {
      result = result.filter(p => p.categoryKey === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, search, allProtocols]);

  const counts = useMemo(() => {
    const c = { all: allProtocols.length };
    CATEGORIES.slice(1).forEach(cat => {
      c[cat] = allProtocols.filter(p => p.categoryKey === cat).length;
    });
    return c;
  }, [allProtocols]);

  return (
    <div className="mb-animate-in">
      <h1 className="mb-h1 mb-mb-sm">MegaETH Ecosystem</h1>
      <p className="mb-text-sm mb-mb-lg">
        {allProtocols.length}+ projects building on MegaETH.
      </p>

      <div className="mb-flex mb-items-center mb-gap-md mb-mb-lg" style={{ flexWrap: 'wrap' }}>
        <div className="mb-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`mb-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)} ({counts[cat] || 0})
            </button>
          ))}
        </div>

        <div className="mb-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} />
          <input
            className="mb-input"
            placeholder="Search protocols..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontFamily: 'var(--mb-font-body)' }}
          />
        </div>
      </div>

      <div className="mb-grid-3">
        {filtered.map(p => (
          <ProtocolCard
            key={p.name}
            name={p.name}
            category={p.category}
            description={p.description}
            url={p.url}
            categoryColor={p.categoryKey}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mb-empty">
          <p>No protocols found matching your search.</p>
        </div>
      )}
    </div>
  );
}
