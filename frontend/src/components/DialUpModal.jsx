import { useState, useEffect, useRef } from 'react';

const DIALUP_SEQUENCE = [
  { text: 'ATZ', color: 'var(--terminal-green)', delay: 400 },
  { text: 'OK', color: 'var(--terminal-amber)', delay: 300 },
  { text: 'ATDT *67 8453-MEGA-NET', color: 'var(--terminal-green)', delay: 600 },
  { text: 'DIALING...', color: 'var(--terminal-cyan)', delay: 1200 },
  { text: 'CARRIER DETECTED', color: 'var(--terminal-amber)', delay: 800 },
  { text: '~~ kshhhhhhhhh ~~', color: '#666', delay: 1500 },
  { text: 'CONNECT 56000', color: 'var(--terminal-green)', delay: 600 },
  { text: 'Authenticating wallet...', color: 'var(--terminal-cyan)', delay: 1200 },
  { text: 'Processing hiring contract...', color: 'var(--terminal-cyan)', delay: 1500 },
  { text: 'Generating archetype DNA...', color: 'var(--terminal-magenta)', delay: 1200 },
  { text: 'Broadcasting to MegaETH...', color: 'var(--terminal-amber)', delay: 1500 },
  { text: 'Block confirmed', color: 'var(--terminal-green)', delay: 800 },
  { text: '=== DEV HIRED SUCCESSFULLY ===', color: 'var(--gold)', delay: 500 },
];

export default function DialUpModal({ devCount, corp, onComplete, onCancel }) {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const terminalRef = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    let i = 0;
    const totalDelay = DIALUP_SEQUENCE.reduce((a, s) => a + s.delay, 0);
    let elapsed = 0;

    const runNext = () => {
      if (cancelled.current || i >= DIALUP_SEQUENCE.length) {
        if (!cancelled.current) {
          setProgress(100);
          setStatus('Complete!');
          setTimeout(() => {
            if (!cancelled.current) onComplete?.();
          }, 1000);
        }
        return;
      }

      const step = DIALUP_SEQUENCE[i];
      setLines(prev => [...prev, step]);
      elapsed += step.delay;
      setProgress(Math.round((elapsed / totalDelay) * 100));
      setStatus(step.text);
      i++;
      setTimeout(runNext, step.delay);
    };

    setTimeout(runNext, 500);

    return () => { cancelled.current = true; };
  }, [onComplete]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="dialup-overlay">
      <div className="dialup-window">
        <div className="win98-titlebar" style={{ cursor: 'default' }}>
          <span className="win98-titlebar-icon">{'\u{1F4DE}'}</span>
          <span className="win98-titlebar-title">
            Hiring {devCount} Dev{devCount > 1 ? 's' : ''} \u2014 {corp || 'MegaETH Network'}...
          </span>
        </div>

        <div className="dialup-terminal" ref={terminalRef}>
          {lines.map((line, i) => (
            <div key={i} style={{ color: line.color }}>
              {'> '}{line.text}
            </div>
          ))}
          {lines.length < DIALUP_SEQUENCE.length && (
            <div style={{ color: 'var(--terminal-green)', animation: 'blink 1s infinite' }}>_</div>
          )}
        </div>

        <div className="dialup-progress">
          <div className="dialup-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px' }}>{status}</span>
          <button className="win-btn" onClick={() => { cancelled.current = true; onCancel?.(); }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
