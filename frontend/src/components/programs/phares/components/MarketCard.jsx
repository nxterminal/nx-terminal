import { CATEGORY_COLORS, OPTION_COLORS } from '../constants';

export default function MarketCard({ market, isSelected, onSelect }) {
  const catColor = CATEGORY_COLORS[market.category];

  return (
    <div
      className={`phares-market-card ${isSelected ? 'phares-market-card--selected' : ''}`}
      onClick={() => onSelect(market)}
    >
      <div className="phares-card-head">
        <div className="phares-card-category">
          <span className="phares-category-dot" style={{ background: catColor }} />
          <span className="phares-category-name" style={{ color: catColor }}>
            {market.category}
          </span>
        </div>
        <div className="phares-card-time">
          <span className="phares-live-dot" />
          {market.timeLeft}
        </div>
      </div>

      <div className="phares-card-question">{market.question}</div>

      <div className="phares-options">
        {market.options.map((opt, i) => {
          const color = OPTION_COLORS[opt.color];
          return (
            <div className="phares-option" key={i}>
              <div
                className="phares-option-bg"
                style={{ width: `${opt.pct}%`, background: color }}
              />
              <span className="phares-option-name" style={{ color }}>{opt.name}</span>
              <div className="phares-option-track">
                <div
                  className="phares-option-fill"
                  style={{ width: `${opt.pct}%`, background: color }}
                />
              </div>
              <span className="phares-option-pct">{opt.pct}%</span>
              <span className="phares-option-mult" style={{ color }}>{opt.multiplier}x</span>
            </div>
          );
        })}
      </div>

      <div className="phares-card-footer">
        <div className="phares-card-meta">
          <span className="phares-card-meta-item">
            Pool <span className="phares-card-meta-value">{market.pool}</span>
          </span>
          <span className="phares-card-meta-item">
            Traders <span className="phares-card-meta-value">{market.traders}</span>
          </span>
        </div>
        <span className="phares-source-badge">{market.source}</span>
      </div>
    </div>
  );
}
