import { useState } from 'react';
import { COLORS } from '../constants';

function formatBlockNum(n) {
  if (!n) return '---';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString();
}

export default function ConsensusPipeline({ blockNumber = 0 }) {
  const [expanded, setExpanded] = useState(false);

  const stages = [
    { label: 'PROP', color: COLORS.cyan, block: blockNumber + 2 },
    { label: 'VOTE', color: COLORS.primary, block: blockNumber + 1 },
    { label: 'FIN', color: COLORS.green, block: blockNumber },
    { label: 'EXEC', color: COLORS.yellow, block: blockNumber - 3 },
  ];

  return (
    <div
      style={{
        padding: '4px 10px',
        background: COLORS.bg,
        borderTop: `1px solid ${COLORS.border}`,
        fontFamily: '"Courier New", monospace',
        fontSize: '10px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {!expanded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: COLORS.primary, fontWeight: 'bold', flexShrink: 0 }}>PIPELINE</span>
          {stages.map((s, i) => (
            <span key={s.label}>
              <span style={{ color: s.color }}>{s.label}</span>
              <span style={{ color: '#666' }}>:</span>
              <span style={{ color: '#aaa' }}>{formatBlockNum(s.block)}</span>
              {i < stages.length - 1 && <span style={{ color: '#333', margin: '0 2px' }}>|</span>}
            </span>
          ))}
          <span style={{ color: '#444', marginLeft: 'auto', fontSize: '9px' }}>[click to expand]</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ color: COLORS.primary, fontWeight: 'bold' }}>MONADBFT PIPELINE</span>
            <span style={{ color: '#444', fontSize: '9px' }}>[click to collapse]</span>
          </div>
          {stages.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: s.color, width: '32px', fontWeight: 'bold' }}>{s.label}</span>
              <div style={{
                flex: 1,
                height: '12px',
                background: '#111',
                border: `1px solid ${COLORS.border}`,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '0',
                  transform: 'translateX(-50%)',
                  height: '100%',
                  padding: '0 4px',
                  background: s.color,
                  opacity: 0.3,
                  transition: 'all 400ms ease',
                }} />
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '9px',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}>
                  Block {formatBlockNum(s.block)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
