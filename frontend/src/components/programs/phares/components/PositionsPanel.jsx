import { MOCK_POSITIONS } from '../constants';

export default function PositionsPanel() {
  return (
    <div className="phares-panel">
      <div className="phares-panel-label">Open Positions</div>
      {MOCK_POSITIONS.map((pos, i) => (
        <div key={i} className="phares-pos-row">
          <div className="phares-pos-question">{pos.question}</div>
          <div className="phares-pos-detail">
            <span className={`phares-pos-badge phares-pos-badge--${pos.side === 'YES' ? 'yes' : 'no'}`}>
              {pos.side}
            </span>
            <span className="phares-pos-amount">{pos.amount} NXT</span>
            <span className="phares-pos-return">{pos.potential} NXT</span>
          </div>
        </div>
      ))}
    </div>
  );
}
