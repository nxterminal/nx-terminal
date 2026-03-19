import { MOCK_RESOLVED } from '../constants';

export default function Resolved() {
  return (
    <>
      <div className="phares-toolbar">
        <span className="phares-toolbar-title">Resolved Markets</span>
      </div>
      {MOCK_RESOLVED.map((m, i) => (
        <div
          key={m.id}
          className={`phares-resolved-card phares-resolved-card--${m.result.toLowerCase()}`}
          style={{ animationDelay: `${i * 0.03}s` }}
        >
          <div className="phares-resolved-header">
            <span className="phares-resolved-question">{m.question}</span>
            <span className={`phares-resolved-badge phares-resolved-badge--${m.result.toLowerCase()}`}>
              RESOLVED: {m.result} {m.won ? '✓' : '✗'}
            </span>
          </div>
          <div className="phares-resolved-meta">
            <span>Settled: <span className="phares-resolved-meta-value">{m.settled}</span></span>
            <span>Pool: <span className="phares-resolved-meta-value">{m.pool}</span></span>
            <span>Winners: <span className="phares-resolved-meta-value">{m.winners}</span></span>
          </div>
        </div>
      ))}
    </>
  );
}
