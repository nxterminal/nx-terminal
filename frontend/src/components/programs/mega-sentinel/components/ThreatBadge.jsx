import { getRiskLevel, RISK_LEVELS } from '../constants';

export default function ThreatBadge({ level, score }) {
  const risk = typeof score === 'number' ? getRiskLevel(score) : (RISK_LEVELS[level] || RISK_LEVELS.WARNING);

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      fontFamily: '"VT323", "Courier New", monospace',
      fontSize: '12px',
      fontWeight: 'bold',
      color: risk.color,
      background: risk.bg,
      border: `1px solid ${risk.color}`,
      letterSpacing: '1px',
    }}>
      {risk.label}{typeof score === 'number' ? ` ${score}/100` : ''}
    </span>
  );
}
