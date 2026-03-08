import { COLORS, TARGET_TPS, BLOCK_TIME_MS } from '../constants';

export default function ParallelLoad({ txCount = 0 }) {
  const activeLanes = Math.min(8, Math.max(1, Math.ceil(txCount / (TARGET_TPS * BLOCK_TIME_MS / 1000 / 8))));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 10px',
      background: COLORS.bg,
      borderTop: `1px solid ${COLORS.border}`,
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
    }}>
      <span style={{ color: COLORS.primary, fontWeight: 'bold', flexShrink: 0 }}>PARALLEL</span>
      <div style={{ display: 'flex', gap: '3px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{
              width: '16px',
              height: '16px',
              border: `1px solid ${i < activeLanes ? COLORS.primaryLight : '#333'}`,
              background: i < activeLanes ? COLORS.primary : '#1a1a1a',
              boxShadow: i < activeLanes ? `0 0 4px ${COLORS.primaryDim}` : 'none',
              transition: 'all 200ms ease',
            }}
          />
        ))}
      </div>
      <span style={{ color: COLORS.primaryLight, fontSize: '10px' }}>
        {activeLanes}/8 LANES ACTIVE
      </span>
    </div>
  );
}
