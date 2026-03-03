import { useState, useEffect, useRef } from 'react';
import { BOOT_MESSAGES } from '../data/constants';

export default function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    if (sessionStorage.getItem('pharos_sdk_boot_seen')) {
      onComplete();
      return;
    }

    const timers = BOOT_MESSAGES.map((msg) => {
      return setTimeout(() => {
        setLines((prev) => [...prev, msg]);
      }, msg.delay);
    });

    const lastDelay = BOOT_MESSAGES[BOOT_MESSAGES.length - 1].delay;
    timers.push(setTimeout(() => {
      setDone(true);
    }, lastDelay + 600));

    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    sessionStorage.setItem('pharos_sdk_boot_seen', '1');
    onComplete();
  };

  const handleEnter = () => {
    sessionStorage.setItem('pharos_sdk_boot_seen', '1');
    onComplete();
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#000',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 20px',
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      overflow: 'auto',
    }}>
      <div style={{ flex: 1 }}>
        {lines.map((msg, i) => (
          <div key={i} style={{ color: msg.color || '#aaa', lineHeight: '1.5' }}>
            {msg.text || '\u00A0'}
          </div>
        ))}
        {done && (
          <button
            onClick={handleEnter}
            style={{
              marginTop: '8px',
              background: 'none',
              border: '1px solid #00ff41',
              color: '#00ff41',
              fontFamily: '"Courier New", monospace',
              fontSize: '13px',
              padding: '6px 16px',
              cursor: 'pointer',
            }}
          >
            {'\u25B6'} ENTER TRAINING
          </button>
        )}
      </div>
      {!done && (
        <div style={{ textAlign: 'right' }}>
          <span
            onClick={handleSkip}
            style={{ color: '#555', cursor: 'pointer', fontSize: '11px' }}
          >
            [SKIP]
          </span>
        </div>
      )}
    </div>
  );
}
