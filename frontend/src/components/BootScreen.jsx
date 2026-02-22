import { useState, useEffect, useCallback, useRef } from 'react';

const NX_LOGO = [
  ' ███╗   ██╗ ██╗  ██╗',
  ' ████╗  ██║ ╚██╗██╔╝',
  ' ██╔██╗ ██║  ╚███╔╝ ',
  ' ██║╚██╗██║  ██╔██╗ ',
  ' ██║ ╚████║ ██╔╝ ██╗',
  ' ╚═╝  ╚═══╝ ╚═╝  ╚═╝',
];

const RANDOM_LINES = [
  'Detecting employee morale... NOT FOUND',
  'Loading corporate_propaganda.dll... FAILED',
  'Scanning for work-life balance... 404 NOT FOUND',
  'Checking developer sanity... CORRUPTED',
  'Initializing coffee_dependency.sys... CRITICAL',
];

const BIOS_LINES = [
  { text: '', type: 'blank' },
  { text: 'Version 4.86.33, Copyright (C) 1998 NX Terminal Corp.', type: 'info' },
  { text: 'NX-486DX (NXT-PROTOCOL.BSS) BIOS Date: 03/15/1998', type: 'info' },
  { text: '', type: 'blank' },
  { text: 'Press <DEL> to enter setup. Press <F9> to access Employee Handbook.', type: 'dim' },
  { text: 'Press <F12> to file resignation (DENIED).', type: 'dim' },
  { text: '', type: 'blank' },
  { text: 'Processor Type: NX-486DX CPU @ 66MHz', type: 'info' },
  { text: 'Processor Speed: 66 MHz', type: 'info' },
  { text: 'MEMORY_COUNTER', type: 'memory' },
  { text: '', type: 'blank' },
  { text: 'USB Devices total: 0 KBDs, 1 MICE, 0 MODEMS, 1 COFFEE MACHINE', type: 'info' },
  { text: '', type: 'blank' },
  { text: 'Detected ATA/ATAPI Devices...', type: 'info' },
  { text: 'SATA PORT SATA-0: HDD 500MB, S.M.A.R.T Supported', type: 'info' },
  { text: 'SATA PORT SATA-1: PROTOCOL_WARS.ISO, S.M.A.R.T Not Supported', type: 'warn' },
  { text: 'RANDOM_LINE', type: 'random' },
  { text: '', type: 'blank' },
  { text: 'New Employee Detected.', type: 'highlight' },
  { text: 'Press <DEL> to enter setup and accept corporate terms.', type: 'dim' },
  { text: '', type: 'blank' },
  { text: 'Initializing NX-DOS 6.22 with Protocol Wars Extension Pack...', type: 'highlight' },
];

export default function BootScreen({ onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [memoryValue, setMemoryValue] = useState(0);
  const [phase, setPhase] = useState('typing');
  const lineIndex = useRef(0);
  const memoryInterval = useRef(null);
  const timerRef = useRef(null);
  const hasRandomLine = useRef(Math.random() < 0.05);

  const skip = useCallback(() => {
    if (phase === 'crt') return;
    clearTimeout(timerRef.current);
    clearInterval(memoryInterval.current);
    setPhase('crt');
    setTimeout(() => onComplete(), 1000);
  }, [phase, onComplete]);

  useEffect(() => {
    const handleKey = () => skip();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [skip]);

  const animateMemory = useCallback(() => {
    return new Promise((resolve) => {
      const steps = [0, 64, 128, 192, 256, 384, 512, 576, 640];
      let i = 0;
      memoryInterval.current = setInterval(() => {
        if (i < steps.length) {
          setMemoryValue(steps[i]);
          i++;
        } else {
          clearInterval(memoryInterval.current);
          resolve();
        }
      }, 60);
    });
  }, []);

  useEffect(() => {
    if (phase !== 'typing') return;

    const addNextLine = async () => {
      if (lineIndex.current >= BIOS_LINES.length) {
        setPhase('crt');
        setTimeout(() => onComplete(), 1000);
        return;
      }

      const line = BIOS_LINES[lineIndex.current];

      if (line.type === 'random' && !hasRandomLine.current) {
        lineIndex.current++;
        timerRef.current = setTimeout(addNextLine, 30);
        return;
      }

      if (line.type === 'memory') {
        setDisplayedLines(prev => [...prev, { text: '', type: 'info', isMemory: true }]);
        await animateMemory();
        lineIndex.current++;
        timerRef.current = setTimeout(addNextLine, 100);
        return;
      }

      if (line.type === 'random') {
        const randomText = RANDOM_LINES[Math.floor(Math.random() * RANDOM_LINES.length)];
        setDisplayedLines(prev => [...prev, { text: randomText, type: 'warn' }]);
        lineIndex.current++;
        timerRef.current = setTimeout(addNextLine, 300);
        return;
      }

      setDisplayedLines(prev => [...prev, line]);
      lineIndex.current++;

      let delay;
      if (line.type === 'blank') {
        delay = 50;
      } else if (line.type === 'highlight') {
        delay = 400;
      } else if (line.text.includes('Detected')) {
        delay = 500;
      } else {
        delay = Math.random() * 200 + 80;
      }

      timerRef.current = setTimeout(addNextLine, delay);
    };

    timerRef.current = setTimeout(addNextLine, 300);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(memoryInterval.current);
    };
  }, [phase, onComplete, animateMemory]);

  const getLineColor = (type) => {
    switch (type) {
      case 'highlight': return '#ffffff';
      case 'warn': return '#ffaa00';
      case 'dim': return '#808080';
      default: return '#c0c0c0';
    }
  };

  if (phase === 'crt') {
    return (
      <div className="boot-bios boot-fadeout" onClick={skip} />
    );
  }

  return (
    <div className="boot-bios" onClick={skip}>
      <div className="bios-header">
        <pre className="bios-logo">
          {NX_LOGO.join('\n')}
        </pre>
        <div className="bios-corp-name">NX Terminal Corp.</div>
      </div>

      <div className="bios-body">
        {displayedLines.map((line, i) => {
          if (line.type === 'blank') {
            return <div key={i} className="bios-line">&nbsp;</div>;
          }
          if (line.isMemory) {
            return (
              <div key={i} className="bios-line" style={{ color: '#c0c0c0' }}>
                Total Memory: {memoryValue}K (Should Be Enough For Anyone)
              </div>
            );
          }
          return (
            <div
              key={i}
              className="bios-line"
              style={{ color: getLineColor(line.type) }}
            >
              {line.text}
            </div>
          );
        })}
        <span className="bios-cursor">_</span>
      </div>
    </div>
  );
}
