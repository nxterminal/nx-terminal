import { useState, useEffect } from 'react';

const BOOT_MESSAGES = [
  'Initializing NX_KERNEL v3.7.1...',
  'Loading blockchain subsystem...',
  'Connecting to Protocol Wars network...',
  'Mounting /dev/nft0...',
  'Spawning 35,000 AI developer processes...',
  'Calibrating degen coefficients...',
  'Loading trollbox modules...',
  'Syncing simulation state...',
  'Ready.',
];

export default function BootScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (progress >= 100) {
      setDone(true);
      return;
    }

    const speed = Math.random() * 200 + 100;
    const increment = Math.random() * 15 + 5;
    const timer = setTimeout(() => {
      setProgress(prev => Math.min(prev + increment, 100));
      setMessageIndex(prev => Math.min(prev + 1, BOOT_MESSAGES.length - 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [progress]);

  const handleClick = () => {
    if (done) onComplete();
  };

  return (
    <div className="boot-screen" onClick={handleClick}>
      <div className="boot-title">NX TERMINAL</div>
      <div className="boot-subtitle">PROTOCOL WARS</div>

      <div className="boot-loader">
        <div
          className="boot-loader-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="boot-message">
        {BOOT_MESSAGES[messageIndex]}
      </div>

      {done && (
        <div className="boot-continue">
          {'> Click anywhere to continue_'}
        </div>
      )}
    </div>
  );
}
