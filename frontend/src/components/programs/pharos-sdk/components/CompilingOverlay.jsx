import { useState, useEffect, useRef } from 'react';

const COMPILE_STEPS = [
  { text: "> Parsing source code...", delay: 400 },
  { text: "> Checking syntax... OK", delay: 900 },
  { text: "> Resolving dependencies... OK", delay: 1400 },
  { text: "> Analyzing storage layout... OK", delay: 1900 },
  { text: "> Optimizing bytecode... OK", delay: 2300 },
  { text: "> Verifying on Pharos...", delay: 2700 },
];

const FAIL_STEPS = [
  { text: "> Parsing source code...", delay: 400 },
  { text: "> Checking syntax... OK", delay: 900 },
  { text: "> Resolving dependencies... OK", delay: 1400 },
  { text: "> Analyzing storage layout...", delay: 1900 },
  { text: "> Verification FAILED", delay: 2300 },
  { text: "> Errors detected in source code", delay: 2600 },
];

export default function CompilingOverlay({ success, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState([]);
  const timersRef = useRef([]);
  const steps = success ? COMPILE_STEPS : FAIL_STEPS;

  useEffect(() => {
    const timers = [];
    // Progress bar
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 2;
      });
    }, 60);
    timers.push(interval);

    // Step lines
    steps.forEach((step) => {
      timers.push(setTimeout(() => {
        setLines(prev => [...prev, step.text]);
      }, step.delay));
    });

    // Complete
    timers.push(setTimeout(() => {
      onComplete();
    }, 3200));

    timersRef.current = timers;
    return () => {
      timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    };
  }, [success, onComplete, steps]);

  const barWidth = 30;
  const filled = Math.round((progress / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const color = success ? '#00ff41' : '#ff3333';

  return (
    <div className="ps-compiling-overlay">
      <div style={{ color, fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textShadow: `0 0 10px ${color}` }}>
        COMPILING...
      </div>
      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '12px', marginBottom: '12px', color: '#888' }}>
        [{bar}] {progress}%
      </div>
      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '12px', textAlign: 'left', minWidth: '300px' }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: line.includes('FAILED') || line.includes('Errors') ? '#ff3333' : line.includes('OK') ? '#00ff41' : '#aaa',
          }}>
            {line}
          </div>
        ))}
      </div>
      {!success && progress >= 100 && (
        <div style={{ color: '#ff3333', marginTop: '16px', fontSize: '14px', textShadow: '0 0 10px #ff3333' }}>
          {'\u2550'.repeat(3)} COMPILATION FAILED {'\u2550'.repeat(3)}
        </div>
      )}
    </div>
  );
}
