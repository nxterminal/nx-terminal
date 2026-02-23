/**
 * CorpBar — Corporation dominance progress bar.
 * Props: name, color, gradient ([dark, light]), percentage, rank
 */

const RANK_MEDALS = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' };

export default function CorpBar({ name, color, gradient, percentage, rank }) {
  const medal = RANK_MEDALS[rank] || '';
  const bg = gradient
    ? `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})`
    : color;

  return (
    <div className="corp-bar-container">
      <div className="corp-bar-name" style={{ color }}>
        {name}
      </div>
      <div className="corp-bar-track">
        <div
          className="corp-bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            background: bg,
          }}
        />
      </div>
      <div className="corp-bar-pct" style={{ color }}>
        {Math.round(percentage)}%
      </div>
      <div className="corp-bar-rank">
        {medal}
      </div>
    </div>
  );
}
