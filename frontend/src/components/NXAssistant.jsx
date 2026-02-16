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
];

const PIXEL_ROBOT = (
  <svg width="48" height="48" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
    <rect x="5" y="1" width="6" height="2" fill="#808080" />
    <rect x="7" y="0" width="2" height="1" fill="#ff4444" />
    <rect x="4" y="3" width="8" height="6" fill="#c0c0c0" />
    <rect x="3" y="3" width="1" height="6" fill="#808080" />
    <rect x="12" y="3" width="1" height="6" fill="#808080" />
    <rect x="5" y="4" width="2" height="2" fill="#000080" />
    <rect x="9" y="4" width="2" height="2" fill="#000080" />
    <rect x="6" y="7" width="4" height="1" fill="#404040" />
    <rect x="5" y="9" width="6" height="4" fill="#808080" />
    <rect x="3" y="10" width="2" height="3" fill="#c0c0c0" />
    <rect x="11" y="10" width="2" height="3" fill="#c0c0c0" />
    <rect x="5" y="13" width="2" height="2" fill="#404040" />
    <rect x="9" y="13" width="2" height="2" fill="#404040" />
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
        {PIXEL_ROBOT}
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
