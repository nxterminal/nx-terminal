import { useState, useEffect, useRef } from 'react';

const DIALUP_STEPS = [
  { text: 'Initializing modem...', duration: 800 },
  { text: 'Dialing NX Terminal Corp. mainframe...', duration: 1200 },
  { text: 'ATDT 555-0198-NXT', duration: 600 },
  { text: 'Negotiating baud rate... 56000 bps', duration: 1000 },
  { text: 'Authenticating employee credentials...', duration: 800 },
  { text: 'Verifying corporate loyalty score...', duration: 600 },
  { text: 'Connecting to Protocol Wars server...', duration: 1000 },
  { text: 'Synchronizing developer database...', duration: 700 },
  { text: 'Downloading personality matrices...', duration: 900 },
  { text: 'Connection established!', duration: 500 },
];

export default function DialUpModal({ onComplete, onCancel }) {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    let timeout;
    const runStep = () => {
      if (stepRef.current >= DIALUP_STEPS.length) {
        setDone(true);
        timeout = setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500);
        return;
      }
      const step = DIALUP_STEPS[stepRef.current];
      setLines(prev => [...prev, step.text]);
      setProgress(((stepRef.current + 1) / DIALUP_STEPS.length) * 100);
      stepRef.current++;
      timeout = setTimeout(runStep, step.duration);
    };
    timeout = setTimeout(runStep, 500);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10010,
    }}>
      <div style={{
        width: '420px',
        background: 'var(--win-bg)',
        boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 var(--border-light), inset -2px -2px 0 var(--border-dark), inset 2px 2px 0 #dfdfdf',
      }}>
        <div style={{
          background: 'linear-gradient(90deg, var(--win-title-l), var(--win-title-r))',
          color: 'white',
          padding: '2px 6px',
          fontWeight: 'bold',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          height: '22px',
        }}>
          Connecting to NX Terminal Corp.
        </div>

        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px', fontFamily: "'VT323', monospace", fontWeight: 'bold' }}>[MODEM]</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>NX Terminal Dial-Up Connection</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Connecting via 56K modem...</div>
            </div>
          </div>

          <div className="win-panel" style={{
            height: '120px',
            overflow: 'auto',
            padding: '6px',
            marginBottom: '8px',
            fontFamily: "'VT323', monospace",
            fontSize: '13px',
            background: '#0c0c0c',
            color: 'var(--terminal-green)',
          }}>
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {!done && <span style={{ animation: 'blink 1s infinite' }}>_</span>}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', marginBottom: '2px' }}>Connection Progress:</div>
            <div className="win-panel" style={{ height: '16px', padding: '2px' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--selection)',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            {done ? (
              <div style={{ fontSize: '11px', color: 'var(--green-on-grey)', fontWeight: 'bold' }}>
                Connection established! Developer deployed.
              </div>
            ) : (
              <button className="win-btn" onClick={onCancel} style={{ padding: '3px 16px' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
