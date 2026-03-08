import { CORPS, COLORS } from '../constants';

export default function CorpActivityBar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '4px 10px',
      background: COLORS.bg,
      borderTop: `1px solid ${COLORS.border}`,
      fontFamily: '"Courier New", monospace',
      fontSize: '9px',
      overflow: 'hidden',
    }}>
      <span style={{ color: COLORS.primary, flexShrink: 0 }}>CORPS:</span>
      {CORPS.map((corp) => (
        <span key={corp.name} style={{ color: corp.color, whiteSpace: 'nowrap' }}>
          {corp.name}
        </span>
      ))}
    </div>
  );
}
