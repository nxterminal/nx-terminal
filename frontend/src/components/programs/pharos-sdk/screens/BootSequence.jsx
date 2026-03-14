import { useState, useEffect, useRef } from 'react';
import { BOOT_MESSAGES } from '../data/constants';

export default function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    if (sessionStorage.getItem('monad_sdk_boot_seen')) {
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
    sessionStorage.setItem('monad_sdk_boot_seen', '1');
    onComplete();
  };

  const handleEnter = () => {
    sessionStorage.setItem('monad_sdk_boot_seen', '1');
    onComplete();
  };

  return (
    <div className="ps-boot-content">
      <div style={{ flex: 1 }}>
        {lines.map((msg, i) => (
          <div key={i} style={{ color: msg.color || '#aaa', lineHeight: '1.5' }}>
            {msg.text || '\u00A0'}
          </div>
        ))}
        {done && (
          <div style={{ marginTop: '12px' }}>
            <button className="ps-wiz-btn" onClick={handleEnter}>
              {'\u25B6'} Enter Training
            </button>
          </div>
        )}
      </div>
      {!done && (
        <div className="ps-boot-skip" onClick={handleSkip}>[SKIP]</div>
      )}
    </div>
  );
}
