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

// Clippy-style paperclip character - more faithful to the original
const CLIPPY_SVG = (
  <svg width="42" height="58" viewBox="0 0 42 58" style={{ imageRendering: 'auto' }}>
    {/* Main wire body - the iconic paperclip shape */}
    <path
      d="M21 2 C10 2 5 10 5 18 L5 34 C5 40 9 44 14 44 L14 44 C14 44 14 48 14 48"
      fill="none" stroke="#a0a0a0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="M21 2 C32 2 37 10 37 18 L37 34 C37 40 33 44 28 44 L28 44 C28 44 28 48 28 48"
      fill="none" stroke="#a0a0a0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
    />
    {/* Inner wire highlight for 3D effect */}
    <path
      d="M21 4 C12 4 7 11 7 18 L7 33 C7 38 10 42 14 42"
      fill="none" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"
    />
    <path
      d="M21 4 C30 4 35 11 35 18 L35 33 C35 38 32 42 28 42"
      fill="none" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"
    />

    {/* Eyes - large, round, expressive like original Clippy */}
    <ellipse cx="15" cy="20" rx="4.5" ry="5" fill="white" stroke="#505050" strokeWidth="1.2" />
    <ellipse cx="27" cy="20" rx="4.5" ry="5" fill="white" stroke="#505050" strokeWidth="1.2" />
    {/* Pupils - looking slightly to the side */}
    <ellipse cx="16.5" cy="21" rx="2.2" ry="2.5" fill="#1a1a3e" />
    <ellipse cx="28.5" cy="21" rx="2.2" ry="2.5" fill="#1a1a3e" />
    {/* Eye shine/reflection */}
    <circle cx="15" cy="18.5" r="1.2" fill="white" opacity="0.9" />
    <circle cx="27" cy="18.5" r="1.2" fill="white" opacity="0.9" />

    {/* Eyebrows - expressive, slightly raised */}
    <path d="M10 13.5 Q15 11 19 13" fill="none" stroke="#606060" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M23 13 Q27 11 32 13.5" fill="none" stroke="#606060" strokeWidth="1.5" strokeLinecap="round" />

    {/* Mouth - friendly smile */}
    <path d="M16 28 Q21 33 26 28" fill="none" stroke="#505050" strokeWidth="1.5" strokeLinecap="round" />

    {/* Nose hint */}
    <ellipse cx="21" cy="25" rx="1" ry="0.8" fill="#b0b0b0" />

    {/* Feet - the classic little shoes */}
    <ellipse cx="14" cy="52" rx="5" ry="3.5" fill="#c0c0c0" stroke="#808080" strokeWidth="1.2" />
    <ellipse cx="28" cy="52" rx="5" ry="3.5" fill="#c0c0c0" stroke="#808080" strokeWidth="1.2" />
    {/* Shoe shine */}
    <ellipse cx="13" cy="51" rx="2" ry="1" fill="#e0e0e0" opacity="0.5" />
    <ellipse cx="27" cy="51" rx="2" ry="1" fill="#e0e0e0" opacity="0.5" />
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
