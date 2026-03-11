import { COLORS } from '../constants';

function getScoreColor(score) {
  if (score >= 70) return COLORS.accent;
  if (score >= 40) return COLORS.warning;
  return COLORS.danger;
}

export default function ScoreBar({ score = 0, size = 'sm' }) {
  const color = getScoreColor(score);
  const height = size === 'lg' ? 5 : 3;
  const fontSize = size === 'lg' ? 16 : 11;

  return (
    <div className="flow-score-bar">
      <span
        className="flow-score-bar__value"
        style={{ color, fontSize, fontWeight: 700 }}
      >
        {score}
      </span>
      <div className="flow-score-bar__track" style={{ height }}>
        <div
          className="flow-score-bar__fill"
          style={{
            width: `${Math.min(100, score)}%`,
            backgroundColor: color,
            height,
          }}
        />
      </div>
    </div>
  );
}
