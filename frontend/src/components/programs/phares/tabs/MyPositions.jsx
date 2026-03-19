import { MOCK_POSITIONS } from '../constants';

export default function MyPositions() {
  return (
    <>
      <div className="phares-toolbar">
        <span className="phares-toolbar-title">My Open Positions</span>
      </div>
      {MOCK_POSITIONS.map((pos, i) => {
        const odds = (pos.potential / pos.amount).toFixed(2);
        return (
          <div key={i} className="phares-position-card" style={{ animationDelay: `${i * 0.03}s` }}>
            <div className="phares-position-header">
              <span className="phares-position-question">{pos.question}</span>
              <span className={`phares-pos-badge phares-pos-badge--${pos.side === 'YES' ? 'yes' : 'no'}`}>
                {pos.side}
              </span>
            </div>
            <div className="phares-position-stats">
              <div>
                <div className="phares-position-stat-label">Wagered</div>
                <div className="phares-position-stat-value">{pos.amount} NXT</div>
              </div>
              <div>
                <div className="phares-position-stat-label">Potential</div>
                <div className="phares-position-stat-value phares-position-stat-value--accent">{pos.potential} NXT</div>
              </div>
              <div>
                <div className="phares-position-stat-label">Odds</div>
                <div className="phares-position-stat-value">{odds}x</div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
