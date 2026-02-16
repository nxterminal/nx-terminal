import { useState, useEffect, useCallback, useRef } from 'react';

const RANDOM_LINES = [
  'Detecting employee morale... NOT FOUND',
  'Loading corporate_propaganda.dll... FAILED',
  'Checking for signs of independent thought... SUPPRESSED',
  'Verifying soul.sys... FILE CORRUPTED',
  'Running motivation.exe... INSUFFICIENT MEMORY',
  'Scanning for weekend plans... ACCESS DENIED',
];

const NX_LOGO = [
  '    ██████╗     ',
  '   ██╔═══██╗    ',
  '  ██║  ▲  ██║   ',
  ' ██║  ███  ██║  ',
  '██║  █████  ██║ ',
  '██║ ███████ ██║ ',
  '╚██████████████╝',
  ' ╚═════════════╝',
];

export default function BootScreen({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [memoryCount, setMemoryCount] = useState(null);
  const [phase, setPhase] = useState('typing'); // typing | memcount | done | fadeout
  const [crtTransition, setCrtTransition] = useState(false);
  const skipRef = useRef(false);
  const phaseRef = useRef('typing');
  const timerRef = useRef(null);

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Determine if we show the random easter egg (5% chance)
  const [showRandom] = useState(() => Math.random() < 0.05);
  const [randomLine] = useState(() =>
    RANDOM_LINES[Math.floor(Math.random() * RANDOM_LINES.length)]
  );

  // Build the full sequence of lines
  const buildSequence = useCallback(() => {
    const seq = [
      { text: '', delay: 200 },
      { text: 'Version 4.86.33, Copyright (C) 1998 NX Terminal Corp.', delay: 80 },
      { text: 'NX-486DX (NXT-PROTOCOL.BSS) BIOS Date: 03/15/1998', delay: 80 },
      { text: '', delay: 60 },
      { text: 'Press <DEL> to enter setup.', delay: 60 },
      { text: 'Press <F9> to access Employee Handbook.', delay: 60 },
      { text: 'Press <F12> to file resignation (DENIED).', delay: 80 },
      { text: '', delay: 100 },
      { text: 'Processor Type: NX-486DX CPU @ 66MHz', delay: 70 },
      { text: 'Processor Speed: 66 MHz', delay: 70 },
      { text: '__MEMORY_COUNT__', delay: 0 }, // special marker for memory counting
      { text: '', delay: 100 },
      { text: 'USB Devices total: 0 KBDs, 1 MICE, 0 MODEMS, 1 COFFEE MACHINE', delay: 90 },
      { text: '', delay: 80 },
      { text: 'Detected ATA/ATAPI Devices...', delay: 200 },
      { text: 'SATA PORT SATA-0: HDD 500MB, S.M.A.R.T Supported', delay: 120 },
      { text: 'SATA PORT SATA-1: PROTOCOL_WARS.ISO, S.M.A.R.T Not Supported', delay: 120 },
    ];

    if (showRandom) {
      seq.push({ text: '', delay: 60 });
      seq.push({ text: randomLine, delay: 150 });
    }

    seq.push({ text: '', delay: 150 });
    seq.push({ text: 'New Employee Detected. Press <DEL> to enter setup and accept corporate terms.', delay: 200 });
    seq.push({ text: 'Initializing NX-DOS 6.22 with Protocol Wars Extension Pack...', delay: 0 });

    return seq;
  }, [showRandom, randomLine]);

  // Skip handler
  const handleSkip = useCallback(() => {
    if (skipRef.current) return;
    skipRef.current = true;

    if (phaseRef.current === 'fadeout' || phaseRef.current === 'done') {
      return; // already transitioning
    }

    // Clear any running timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Jump straight to CRT transition
    setPhase('fadeout');
    setCrtTransition(true);
    setTimeout(() => {
      onComplete();
    }, 1000);
  }, [onComplete]);

  // Listen for keydown and click to skip
  useEffect(() => {
    const onKey = () => handleSkip();
    const onClick = () => handleSkip();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [handleSkip]);

  // Main typing sequence
  useEffect(() => {
    const sequence = buildSequence();
    let currentIndex = 0;

    const typeNext = () => {
      if (skipRef.current) return;
      if (currentIndex >= sequence.length) {
        // All lines done, wait then transition
        timerRef.current = setTimeout(() => {
          if (skipRef.current) return;
          setPhase('fadeout');
          setCrtTransition(true);
          setTimeout(() => {
            if (!skipRef.current) {
              onComplete();
            }
          }, 1000);
        }, 800);
        return;
      }

      const item = sequence[currentIndex];

      if (item.text === '__MEMORY_COUNT__') {
        // Memory counting phase
        currentIndex++;
        setPhase('memcount');
        const memSteps = [0, 64, 128, 256, 384, 512, 576, 640];
        let memIdx = 0;

        const countMem = () => {
          if (skipRef.current) return;
          if (memIdx >= memSteps.length) {
            setMemoryCount(null);
            setLines(prev => [...prev, 'Total Memory: 640K (Should Be Enough For Anyone)']);
            setPhase('typing');
            timerRef.current = setTimeout(typeNext, 80);
            return;
          }
          setMemoryCount(memSteps[memIdx]);
          memIdx++;
          timerRef.current = setTimeout(countMem, 50);
        };
        countMem();
        return;
      }

      setLines(prev => [...prev, item.text]);
      currentIndex++;
      timerRef.current = setTimeout(typeNext, item.delay);
    };

    timerRef.current = setTimeout(typeNext, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [buildSequence, onComplete]);

  return (
    <div className={`bios-screen ${crtTransition ? 'bios-crt-off' : ''}`}>
      {/* Top section: Logo + branding */}
      <div className="bios-header">
        <div className="bios-logo-area">
          <pre className="bios-logo">{NX_LOGO.join('\n')}</pre>
          <div className="bios-brand">
            <div className="bios-brand-name">NX Terminal Corp.</div>
            <div className="bios-brand-sub">NXT-BIOS (C)1998 NX Terminal Corp.</div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="bios-separator" />

      {/* Middle section: System info lines */}
      <div className="bios-body">
        {lines.map((line, i) => (
          <div key={i} className="bios-line">
            {line}
          </div>
        ))}
        {memoryCount !== null && (
          <div className="bios-line bios-line-counting">
            Memory Test: {memoryCount}K OK
          </div>
        )}
      </div>

      {/* Skip hint */}
      {phase === 'typing' || phase === 'memcount' ? (
        <div className="bios-skip-hint">
          Press any key or click to skip...
        </div>
      ) : null}

      {/* CRT off overlay */}
      {crtTransition && <div className="bios-crt-line" />}
    </div>
  );
}
