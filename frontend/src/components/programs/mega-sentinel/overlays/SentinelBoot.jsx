import { useState, useEffect, useRef } from 'react';
import { BOOT_MESSAGES, BOOT_DURATION, COLORS } from '../constants';

export default function SentinelBoot({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (sessionStorage.getItem('sentinel_boot_seen')) {
      onCompleteRef.current();
      return;
    }

    const timers = BOOT_MESSAGES.map((msg, i) =>
      setTimeout(() => setVisibleLines(i + 1), msg.delay)
    );

    const progressTimer = setInterval(() => {
      setProgress(prev => Math.min(prev + 3, 100));
    }, BOOT_DURATION / 33);

    const doneTimer = setTimeout(() => setDone(true), BOOT_DURATION);

    timersRef.current = [...timers, progressTimer, doneTimer];
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
      clearInterval(progressTimer);
    };
  }, []);

  const handleSkip = () => {
    timersRef.current.forEach(t => { clearTimeout(t); clearInterval(t); });
    sessionStorage.setItem('sentinel_boot_seen', '1');
    onCompleteRef.current();
  };

  const handleEnter = () => {
    sessionStorage.setItem('sentinel_boot_seen', '1');
    onCompleteRef.current();
  };

  const progressBar = '\u2588'.repeat(Math.floor(progress / 3.6)) + '\u2591'.repeat(28 - Math.floor(progress / 3.6));

  return (
    <div style={{
      position: 'absolute', inset: 0, background: COLORS.bg, zIndex: 100,
      display: 'flex', flexDirection: 'column', padding: '20px 24px',
      fontFamily: '"VT323", "Courier New", monospace', fontSize: '14px', overflow: 'auto',
    }}>
      <div style={{ flex: 1 }}>
        {BOOT_MESSAGES.slice(0, visibleLines).map((msg, i) => {
          if (!msg.text) return <div key={i} style={{ height: '14px' }} />;

          const okMatch = msg.text.match(/^(.*?)\s+(OK)$/);
          if (okMatch) {
            return (
              <div key={i} style={{ lineHeight: 1.6 }}>
                <span style={{ color: msg.color }}>{okMatch[1]} </span>
                <span style={{ color: COLORS.green }}>OK</span>
              </div>
            );
          }

          const isTitle = msg.text === 'MEGA SENTINEL v1.0';
          return (
            <div key={i} style={{
              color: msg.color || COLORS.text, lineHeight: 1.6,
              textShadow: isTitle ? `0 0 10px ${COLORS.green}` : 'none',
              fontWeight: isTitle ? 'bold' : 'normal',
              fontSize: isTitle ? '18px' : '14px',
            }}>
              {msg.text}
            </div>
          );
        })}

        {visibleLines > 10 && (
          <div style={{ color: COLORS.dimGreen, marginTop: '4px', letterSpacing: '1px' }}>
            [{progressBar}] {progress}%
          </div>
        )}

        {done && (
          <div style={{ marginTop: '16px' }}>
            <button onClick={handleEnter} style={{
              background: '#c0c0c0', border: '2px solid',
              borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
              padding: '4px 16px', fontFamily: '"VT323", "Courier New", monospace',
              fontSize: '14px', cursor: 'pointer', color: '#000',
            }}>
              {'\u25B6'} ENTER SENTINEL
            </button>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '12px', right: '16px' }}>
        <span onClick={handleSkip} style={{
          color: '#555', fontSize: '11px', cursor: 'pointer',
          fontFamily: '"Courier New", monospace',
        }}>[SKIP]</span>
      </div>
    </div>
  );
}
