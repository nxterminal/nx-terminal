import { COLORS } from '../constants';

export default function ScanProgressBar({ progress, label }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        height: '4px', background: COLORS.border, borderRadius: '2px',
        overflow: 'hidden', marginBottom: '6px',
      }}>
        <div style={{
          width: `${Math.min(progress, 100)}%`, height: '100%',
          background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.cyan})`,
          borderRadius: '2px', transition: 'width 0.3s',
        }} />
      </div>
      {label && (
        <div style={{ fontSize: '11px', color: COLORS.muted }}>
          {label} ({Math.round(progress)}%)
        </div>
      )}
    </div>
  );
}
