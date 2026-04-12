import { useState, useEffect, useRef } from 'react';
import { CORPORATIONS } from '../utils/constants';
import Tooltip from '../components/Tooltip';

const corpKeys = Object.keys(CORPORATIONS);

const CORP_TOOLTIPS = {
  ClosedAI: 'Closed AI \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
  Misanthropic: 'Misanthropic \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
  ShallowMind: 'Shallow Mind \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
  ZuckLabs: 'Zuck Labs \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
  YAI: 'Y.AI \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
  MistrialSystems: 'Mistrial Systems \u2014 Simulated activity level for this corporation. In the full version, this tracks real on-chain activity from NX Terminal devs.',
};

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
      <span style={{ color: '#a0a0a0', fontSize: '9px', marginRight: '4px' }}>CORP:</span>
      {corpKeys.map((key) => {
        const corp = CORPORATIONS[key];
        const bars = '\u2588'.repeat(activity[key]);
        return (
          <Tooltip key={key} text={CORP_TOOLTIPS[key]} style={{ display: 'inline-block', marginRight: '8px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: corp.color }}>{corp.name}</span>
              {' '}
              <span style={{ color: corp.color, opacity: 0.7 }}>{bars}</span>
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
