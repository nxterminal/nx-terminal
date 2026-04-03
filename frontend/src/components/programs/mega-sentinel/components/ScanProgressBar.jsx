import { COLORS } from '../constants';

export default function ScanProgressBar({ progress, label }) {
  const filled = Math.floor((progress / 100) * 28);
  const empty = 28 - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  return (
    <div style={{
      fontFamily: '"VT323", "Courier New", monospace',
      fontSize: '13px', padding: '8px 0',
    }}>
      <div style={{ color: COLORS.cyan, marginBottom: '4px' }}>
        [{bar}] {Math.round(progress)}%
      </div>
      {label && (
        <div style={{ color: COLORS.muted, fontSize: '12px' }}>
          {label}
        </div>
      )}
    </div>
  );
}
