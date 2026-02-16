import { useState, useEffect, useRef, useCallback } from 'react';

const MESSAGES = [
  {
    text: "It looks like you're trying to win the Protocol Wars. Would you like help?",
    buttons: ['Get help', "Don't show this again"],
  },
  {
    text: 'Your developer has been staring at their screen for 3 hours. This is normal.',
    buttons: null,
  },
  {
    text: 'TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.',
    buttons: null,
  },
  {
    text: "I see you haven't collected your salary. It's not going anywhere. Neither are you.",
    buttons: null,
  },
  {
    text: 'Did you know? 73% of protocols fail in their first week. The other 27% fail in their second week.',
    buttons: null,
  },
  {
    text: "It looks like you're writing a protocol. Would you like me to:",
    buttons: ['Add more bugs', 'Add blockchain', 'Both'],
  },
  {
    text: "I noticed you haven't opened the Leaderboard in a while. Your competitors are thriving. You are not.",
    buttons: null,
  },
  {
    text: 'TIP: Closing this window will not fix your problems. But it will make you feel briefly powerful.',
    buttons: null,
  },
  {
    text: "Your synergy levels are dangerously low. Management has been notified. (Management doesn't care.)",
    buttons: null,
  },
  {
    text: "It looks like you're trying to enjoy yourself. This is against corporate policy.",
    buttons: ['Understood', 'File complaint'],
  },
];

// Clippy-style paperclip character in SVG
const CLIPPY_SVG = (
  <svg width="36" height="52" viewBox="0 0 36 52" style={{ imageRendering: 'auto' }}>
    {/* Wire body */}
    <path d="M18 4 C8 4 6 14 6 20 C6 28 8 32 12 36 L12 44" fill="none" stroke="#808080" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 4 C28 4 30 14 30 20 C30 28 28 32 24 36 L24 44" fill="none" stroke="#808080" strokeWidth="3" strokeLinecap="round" />
    {/* Clip top */}
    <path d="M14 4 C14 2 18 0 22 2 C26 4 22 8 18 4" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />
    {/* Eyes */}
    <circle cx="14" cy="18" r="3" fill="white" stroke="#404040" strokeWidth="1" />
    <circle cx="22" cy="18" r="3" fill="white" stroke="#404040" strokeWidth="1" />
    <circle cx="14.5" cy="18.5" r="1.5" fill="#000080" />
    <circle cx="22.5" cy="18.5" r="1.5" fill="#000080" />
    {/* Eyebrows */}
    <line x1="11" y1="14" x2="16" y2="14.5" stroke="#404040" strokeWidth="1" strokeLinecap="round" />
    <line x1="20" y1="14.5" x2="25" y2="14" stroke="#404040" strokeWidth="1" strokeLinecap="round" />
    {/* Mouth */}
    <path d="M14 24 Q18 28 22 24" fill="none" stroke="#404040" strokeWidth="1.5" strokeLinecap="round" />
    {/* Feet */}
    <ellipse cx="12" cy="46" rx="4" ry="3" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />
    <ellipse cx="24" cy="46" rx="4" ry="3" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />
  </svg>
);

export default function NXAssistant() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(null);
  const [fired, setFired] = useState(false);
  const timerRef = useRef(null);

  const isEnabled = useCallback(() => {
    return localStorage.getItem('nx-assistant-enabled') !== 'false';
  }, []);

  const showRandom = useCallback(() => {
    if (!isEnabled()) return;
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    setMessage(msg);
    setVisible(true);
    setFired(false);
  }, [isEnabled]);

  const scheduleNext = useCallback(() => {
    clearTimeout(timerRef.current);
    const delay = (Math.random() * 120000) + 120000;
    timerRef.current = setTimeout(() => {
      showRandom();
      scheduleNext();
    }, delay);
  }, [showRandom]);

  useEffect(() => {
    const handleSettings = () => {
      if (!isEnabled()) {
        setVisible(false);
        clearTimeout(timerRef.current);
      } else {
        scheduleNext();
      }
    };
    window.addEventListener('nx-settings-changed', handleSettings);

    if (isEnabled()) {
      timerRef.current = setTimeout(() => {
        showRandom();
        scheduleNext();
      }, Math.random() * 30000 + 30000);
    }

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('nx-settings-changed', handleSettings);
    };
  }, [isEnabled, showRandom, scheduleNext]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleFire = () => {
    setFired(true);
    setMessage({
      text: 'Your request to terminate the NX Assistant has been received and will be processed in 6-8 business centuries.',
      buttons: null,
    });
    setTimeout(() => {
      setVisible(false);
      setFired(false);
    }, 4000);
  };

  const handleButtonClick = () => {
    setVisible(false);
  };

  if (!visible || !message) return null;

  return (
    <div className="nx-assistant">
      <div className="nx-assistant-character">
        {CLIPPY_SVG}
      </div>
      <div className="nx-assistant-bubble">
        <button className="nx-assistant-close" onClick={handleClose} title="Close">
          x
        </button>
        <div className="nx-assistant-text">{message.text}</div>
        {message.buttons && !fired && (
          <div className="nx-assistant-buttons">
            {message.buttons.map((btn, i) => (
              <button key={i} className="win-btn" onClick={handleButtonClick} style={{ fontSize: '10px', padding: '2px 8px' }}>
                {btn}
              </button>
            ))}
          </div>
        )}
        {!fired && (
          <button
            className="nx-assistant-fire"
            onClick={handleFire}
          >
            Fire this assistant
          </button>
        )}
      </div>
    </div>
  );
}
