import { useState, useEffect, useRef } from 'react';
import { BOOT_MESSAGES } from '../data/constants';

export default function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    if (sessionStorage.getItem('mega_sdk_boot_seen')) {
      onComplete();
      return;
    }

    const timers = BOOT_MESSAGES.map((msg) =>
      setTimeout(() => setLines((prev) => [...prev, msg]), msg.delay)
    );

    const lastDelay = BOOT_MESSAGES[BOOT_MESSAGES.length - 1].delay;
    timers.push(setTimeout(() => setDone(true), lastDelay + 600));

    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    sessionStorage.setItem('mega_sdk_boot_seen', '1');
    onComplete();
  };

  const handleEnter = () => {
    sessionStorage.setItem('mega_sdk_boot_seen', '1');
    onComplete();
  };

  return (
    <div className="ms-boot-content">
      <div style={{ flex: 1 }}>
        {lines.map((msg, i) => {
          const isHighlight = msg.text && (msg.text.includes('PARALLEL EXECUTION') || msg.text.includes('DETERMINISTIC STATE'));
          return (
            <div key={i} style={{
              color: msg.color || '#aaa',
              lineHeight: '1.5',
              textShadow: isHighlight ? '0 0 8px #7B2FBE' : 'none',
              fontWeight: isHighlight ? 'bold' : 'normal',
            }}>
              {msg.text || '\u00A0'}
            </div>
          );
        })}
        {done && (
          <div style={{ marginTop: '12px' }}>
            <button className="ms-wiz-btn" onClick={handleEnter}>
              {'\u25B6'} Enter Training
            </button>
          </div>
        )}
      </div>
      {!done && (
        <div className="ms-boot-skip" onClick={handleSkip}>[SKIP]</div>
      )}
    </div>
  );
}
