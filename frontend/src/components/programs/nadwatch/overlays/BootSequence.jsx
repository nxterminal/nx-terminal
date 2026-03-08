import { useState, useEffect, useRef } from 'react';
import { BOOT_MESSAGES, COLORS } from '../constants';

export default function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    if (sessionStorage.getItem('nadwatch_boot_seen')) {
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
    sessionStorage.setItem('nadwatch_boot_seen', '1');
    onComplete();
  };

  const handleEnter = () => {
    sessionStorage.setItem('nadwatch_boot_seen', '1');
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
      fontFamily: '"VT323", "Courier New", monospace',
      fontSize: '14px',
      overflow: 'auto',
    }}>
      <div style={{ flex: 1 }}>
        {lines.map((msg, i) => {
          if (!msg.text) return <div key={i} style={{ height: '14px' }} />;

          const isGmonad = msg.text.includes('GMONAD');
          const okMatch = msg.text.match(/^(\s*(?:>.*|.*\.\.\.))\s+(OK)$/);

          if (okMatch) {
            return (
              <div key={i} style={{ lineHeight: '1.5' }}>
                <span style={{ color: msg.color }}>{okMatch[1]} </span>
                <span style={{ color: COLORS.green }}>OK</span>
              </div>
            );
          }

          return (
            <div key={i} style={{
              color: msg.color,
              lineHeight: '1.5',
              textShadow: isGmonad ? `0 0 8px ${COLORS.primary}` : 'none',
              fontWeight: isGmonad ? 'bold' : 'normal',
            }}>
              {msg.text}
            </div>
          );
        })}

        {!done && lines.length > 0 && (
          <span className="ndw-cursor" />
        )}

        {done && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleEnter}
              style={{
                background: '#c0c0c0',
                border: '2px solid',
                borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
                padding: '4px 16px',
                fontFamily: '"VT323", "Courier New", monospace',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#000',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.borderColor = '#808080 #dfdfdf #dfdfdf #808080';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.borderColor = '#dfdfdf #808080 #808080 #dfdfdf';
              }}
            >
              {'\u25B6'} ENTER SURVEILLANCE
            </button>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '12px', right: '16px' }}>
        <span
          onClick={handleSkip}
          style={{
            color: '#555',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: '"Courier New", monospace',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#888'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
        >
          [SKIP]
        </span>
      </div>
    </div>
  );
}
