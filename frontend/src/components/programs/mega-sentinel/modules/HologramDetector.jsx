import { COLORS } from '../constants';

export default function HologramDetector() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: '"VT323", monospace', color: COLORS.amber,
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{'\u{1F4A0}'}</div>
      <div>{'>'} HOLOGRAM DETECTOR — Legitimacy Check</div>
      <div style={{ color: COLORS.muted, fontSize: '12px', marginTop: '4px' }}>Module loading...</div>
    </div>
  );
}
