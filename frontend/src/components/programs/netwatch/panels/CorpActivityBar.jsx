import { useState, useEffect, useRef } from 'react';
import { CORPORATIONS } from '../utils/constants';

const corpKeys = Object.keys(CORPORATIONS);

function randomActivity() {
  const out = {};
  for (const key of corpKeys) {
    out[key] = 1 + Math.floor(Math.random() * 7);
  }
  return out;
}

export default function CorpActivityBar({ tick }) {
  const [activity, setActivity] = useState(randomActivity);
  const prevTickRef = useRef(tick);

  useEffect(() => {
    if (tick !== prevTickRef.current) {
      prevTickRef.current = tick;
      setActivity((prev) => {
        const next = {};
        for (const key of corpKeys) {
          const delta = Math.floor(Math.random() * 3) - 1;
          next[key] = Math.max(1, Math.min(7, prev[key] + delta));
        }
        return next;
      });
    }
  }, [tick]);

  return (
    <div className="nw-panel nw-corp-bar" style={{
      padding: '4px 10px',
      fontFamily: '"IBM Plex Mono", "Courier New", monospace',
      fontSize: '10px',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      flexWrap: 'wrap',
      borderTop: '1px solid #222',
    }}>
      <span style={{ color: '#555', fontSize: '9px', marginRight: '4px' }}>CORP:</span>
      {corpKeys.map((key) => {
        const corp = CORPORATIONS[key];
        const bars = '\u2588'.repeat(activity[key]);
        return (
          <span key={key} style={{ marginRight: '8px', whiteSpace: 'nowrap' }}>
            <span style={{ color: corp.color }}>{corp.name}</span>
            {' '}
            <span style={{ color: corp.color, opacity: 0.7 }}>{bars}</span>
          </span>
        );
      })}
    </div>
  );
}
