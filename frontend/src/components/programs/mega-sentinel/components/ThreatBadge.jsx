import { getRiskLevel, RISK_LEVELS } from '../constants';

export default function ThreatBadge({ level, score }) {
  const risk = typeof score === 'number' ? getRiskLevel(score) : (RISK_LEVELS[level] || RISK_LEVELS.WARNING);

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      fontSize: '11px',
      fontWeight: '600',
      color: risk.color,
      background: risk.bg,
      border: `1px solid ${risk.color}`,
      borderRadius: '3px',
      letterSpacing: '0.5px',
    }}>
      {risk.label}{typeof score === 'number' ? ` ${score}/100` : ''}
    </span>
  );
}
