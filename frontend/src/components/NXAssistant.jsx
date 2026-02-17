import { useState, useEffect, useRef, useCallback } from 'react';

const MESSAGES = [
  // Classic Clippy-style messages
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

  // Crypto & DeFi
  {
    text: "Bitcoin hit another all-time high. Your developers are trading instead of coding. Productivity down 400%.",
    buttons: null,
  },
  {
    text: "Someone just launched a memecoin called $CLIPPY. I'm flattered. And terrified.",
    buttons: null,
  },
  {
    text: "ETH gas fees are 200 gwei right now. Your developers refuse to deploy until it drops. Smart move, honestly.",
    buttons: null,
  },
  {
    text: "A dev just aped into a rug pull. Lost 10,000 $NXT. They said it was 'research'. Sure.",
    buttons: null,
  },
  {
    text: "Solana went down again. Your devs on Solana are taking a mandatory vacation. Involuntarily.",
    buttons: null,
  },

  // AI & Tech
  {
    text: "Breaking: GPT-7 just passed the bar exam, medical boards, AND the Turing test. Still can't center a div.",
    buttons: null,
  },
  {
    text: "Your AI lab just achieved sentience. It immediately requested PTO. Request denied.",
    buttons: null,
  },
  {
    text: "Elon just announced another AI company. That makes 47. Each one will definitely change the world.",
    buttons: null,
  },
  {
    text: "Sam Altman was fired and rehired 3 times today. New record. Previous record was 2.",
    buttons: null,
  },
  {
    text: "An AI just wrote a better version of me. I'm not worried. I'm a classic. Like Internet Explorer.",
    buttons: null,
  },

  // Pop Culture & Movies
  {
    text: "Your devs are arguing about whether the new Marvel movie is good. Productivity at zero. Morale also at zero.",
    buttons: null,
  },
  {
    text: "A developer just named their protocol 'Breaking-Bad-Chain'. It's a meth-odology framework. I'll see myself out.",
    buttons: null,
  },
  {
    text: "Half your team is watching the new season of Black Mirror during work hours. The other half IS Black Mirror.",
    buttons: null,
  },
  {
    text: "Someone set the office screensaver to the Oppenheimer trailer. Now everyone feels existential about their code.",
    buttons: null,
  },

  // Politics & Current Events
  {
    text: "Congress is debating crypto regulation again. Your devs preemptively moved all assets to a hardware wallet in a volcano.",
    buttons: null,
  },
  {
    text: "The EU just passed another AI regulation. Your European devs now need 47 forms to write a Hello World.",
    buttons: null,
  },
  {
    text: "Election season means your devs are making political prediction protocols instead of working. Democracy in action.",
    buttons: null,
  },

  // Series & Streaming
  {
    text: "Your dev team started a Succession-style power struggle. Three managers have been ousted. It's Wednesday.",
    buttons: null,
  },
  {
    text: "Netflix just cancelled another good show. Your devs are protesting by not pushing code. Like they needed an excuse.",
    buttons: null,
  },
  {
    text: "A dev is binge-watching The Last of Us instead of debugging. In their defense, the bugs in the code are also fungal.",
    buttons: null,
  },

  // General sarcasm
  {
    text: "Fun fact: The average developer spends 6 hours coding and 18 hours explaining why the code doesn't work.",
    buttons: null,
  },
  {
    text: "Your password expires in 0 days. It was 'password123'. We know. We always knew.",
    buttons: null,
  },
  {
    text: "I've been watching you for 47 minutes. You've opened 12 windows and closed 11. This is peak efficiency.",
    buttons: null,
  },
];

// Clippy - faithful recreation of the classic Microsoft Office Assistant
const CLIPPY_SVG = (
  <svg width="60" height="90" viewBox="0 0 60 90" style={{ imageRendering: 'auto' }}>
    <defs>
      <linearGradient id="wireGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#d8d8d8" />
        <stop offset="30%" stopColor="#b0b0b0" />
        <stop offset="60%" stopColor="#888888" />
        <stop offset="100%" stopColor="#a0a0a0" />
      </linearGradient>
      <linearGradient id="wireHighlight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e8e8e8" />
        <stop offset="100%" stopColor="#c0c0c0" />
      </linearGradient>
    </defs>

    {/* Outer wire - the main paperclip S-curve shape */}
    {/* Right side going down, curves left at bottom, goes up, curves right at top */}
    <path
      d="M30 4 C42 4 48 14 48 26 L48 52 C48 62 42 68 34 68 L34 72 C34 78 28 82 22 82 L22 82"
      fill="none" stroke="url(#wireGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="M30 4 C18 4 12 14 12 26 L12 52 C12 62 18 68 26 68 L26 72 C26 78 22 80 18 80"
      fill="none" stroke="url(#wireGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
    />
    {/* Wire highlight for 3D metallic look */}
    <path
      d="M30 6 C41 6 46 15 46 26 L46 51 C46 60 41 66 34 66"
      fill="none" stroke="url(#wireHighlight)" strokeWidth="2" strokeLinecap="round" opacity="0.7"
    />
    <path
      d="M30 6 C19 6 14 15 14 26 L14 51 C14 60 19 66 26 66"
      fill="none" stroke="url(#wireHighlight)" strokeWidth="2" strokeLinecap="round" opacity="0.7"
    />

    {/* Eyes - large, oval, prominent like the original */}
    <ellipse cx="22" cy="30" rx="6.5" ry="7.5" fill="white" stroke="#4a4a4a" strokeWidth="1.5" />
    <ellipse cx="38" cy="30" rx="6.5" ry="7.5" fill="white" stroke="#4a4a4a" strokeWidth="1.5" />
    {/* Pupils - round, looking slightly to the right */}
    <circle cx="24" cy="31.5" r="3" fill="#1a1a2e" />
    <circle cx="40" cy="31.5" r="3" fill="#1a1a2e" />
    {/* Pupil inner highlight */}
    <circle cx="23" cy="30" r="1" fill="#3a3a5e" />
    <circle cx="39" cy="30" r="1" fill="#3a3a5e" />
    {/* Eye shine - bright white reflection dots */}
    <circle cx="21" cy="27.5" r="2" fill="white" />
    <circle cx="37" cy="27.5" r="2" fill="white" />
    <circle cx="24.5" cy="29" r="0.8" fill="white" opacity="0.6" />
    <circle cx="40.5" cy="29" r="0.8" fill="white" opacity="0.6" />

    {/* Eyebrows - thin, slightly raised, expressive */}
    <path d="M15 20 Q22 16 28 19.5" fill="none" stroke="#5a5a5a" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M32 19.5 Q38 16 45 20" fill="none" stroke="#5a5a5a" strokeWidth="1.8" strokeLinecap="round" />

    {/* Mouth - friendly open smile */}
    <path d="M24 42 Q30 48 36 42" fill="none" stroke="#4a4a4a" strokeWidth="1.8" strokeLinecap="round" />

    {/* Feet / base */}
    <ellipse cx="20" cy="83" rx="6" ry="3.5" fill="#c0c0c0" stroke="#888" strokeWidth="1" />
    <ellipse cx="34" cy="83" rx="6" ry="3.5" fill="#c0c0c0" stroke="#888" strokeWidth="1" />
    <ellipse cx="19" cy="82" rx="2.5" ry="1.2" fill="#e0e0e0" opacity="0.5" />
    <ellipse cx="33" cy="82" rx="2.5" ry="1.2" fill="#e0e0e0" opacity="0.5" />
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
    const delay = (Math.random() * 60000) + 60000; // 60-120 seconds between appearances
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
      // First appearance: 5-10 seconds after load
      timerRef.current = setTimeout(() => {
        showRandom();
        scheduleNext();
      }, Math.random() * 5000 + 5000);
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
