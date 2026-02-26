import { useState, useEffect, useRef, useCallback } from 'react';
import $ from 'jquery';
import clippy from 'clippyjs';
import { api } from '../services/api';

// Must set jQuery globally BEFORE clippy uses it
window.jQuery = $;
window.$ = $;

// jsDelivr serves GitHub files with correct MIME types (application/javascript)
// raw.githubusercontent.com returns text/plain which browsers refuse to execute as scripts
const CLIPPY_CDN = 'https://cdn.jsdelivr.net/gh/smore-inc/clippy.js@master/agents/';
window.CLIPPY_CDN = CLIPPY_CDN;

// Ensure window.clippy is set — JSONP agent scripts call window.clippy.ready()
window.clippy = clippy;

const AGENTS = ['Clippy', 'Merlin', 'Rover', 'Links', 'Peedy', 'Genius', 'F1'];

const WELCOME_MSG = 'Welcome to NX Terminal! I see you haven\'t connected your wallet yet. Open Mint/Hire Devs and click "Connect Wallet to Mint" to get started!';

const MESSAGES = [
  "It looks like you're trying to win the Protocol Wars. Would you like help?",
  'Your developer has been staring at their screen for 3 hours. This is normal.',
  'TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.',
  "I see you haven't collected your salary. It's not going anywhere. Neither are you.",
  'Did you know? 73% of protocols fail in their first week. The other 27% fail in their second week.',
  "It looks like you're writing a protocol. Would you like me to add more bugs?",
  "I noticed you haven't opened the Leaderboard in a while. Your competitors are thriving. You are not.",
  'BREAKING: Local developer claims their code works on their machine. Nobody else can confirm.',
  'Your morale slider in Settings does nothing. Just like real corporate morale initiatives.',
  "According to my calculations, you have a 0.3% chance of winning. That's up from yesterday!",
  'The AI Lab is running at peak capacity. It is also on fire. This is fine.',
  'Remember: In the Protocol Wars, the real exploit was the friends we made along the way.',
  "I've been monitoring your clicks. You seem stressed. Have you tried closing this dialog?",
  'Your developer portfolio is performing exactly as expected. Expectations were low.',
  'The blockchain is immutable. Your poor decisions, however, are not.',
  'ALERT: Someone on World Chat claims to be profitable. Investigation pending.',
  'Fun fact: The term "bug" comes from actual insects in old computers. Your bugs are much worse.',
  'I see you changed the wallpaper. Nice. That will definitely help with the Protocol Wars.',
  "Synergy levels are dropping. Quick, adjust the slider! Oh wait, it doesn't do anything.",
  "Your inbox has unread messages. They're mostly disappointment.",
  'Have you tried turning your developers off and on again?',
  'The market is volatile. By which I mean it exists.',
  "I'd suggest investing in DeFi but I'm legally required not to give financial advice. So definitely invest in DeFi.",
  'Your developer just pushed to main without testing. Bold strategy.',
  'ChatGPT thinks it could beat your developers. ChatGPT is probably right.',
  'Elon just tweeted something. Your portfolio changed. These events may be unrelated.',
  'The SEC would like to know your location. Just kidding. Maybe.',
  'Your NFT is now worth exactly one memory. A fond one, hopefully.',
  'Trump just announced a new crypto policy. Markets are confused. So am I.',
  'A whale just dumped. Your developers are now worth negative vibes.',
  'Remember when Bitcoin was $100? Neither do your developers. They were not yet minted.',
  'The real utility of your NFT is the gas fees you spent along the way.',
  'Breaking: Congress still does not understand crypto. Markets unchanged.',
];

function isWalletConnected() {
  try {
    return window.ethereum && window.ethereum.selectedAddress;
  } catch {
    return false;
  }
}

export default function NXAssistant() {
  const agentRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const messageIndexRef = useRef(0);
  const loadAttemptRef = useRef(0);

  const getAgentName = useCallback(() => {
    return localStorage.getItem('nx-assistant-agent') || 'Clippy';
  }, []);

  const loadAgent = useCallback((agentName) => {
    // Clean up previous agent
    if (agentRef.current) {
      try { agentRef.current.hide(true, () => {}); } catch {}
      agentRef.current = null;
    }
    $('.clippy, .clippy-balloon').remove();
    setLoaded(false);

    // Clear clippyjs internal caches for this agent to avoid stale deferreds
    // (e.g. if a previous load failed with a different CDN, the pending deferred stays stuck forever)
    const agentPath = CLIPPY_CDN + agentName;
    try {
      if (clippy.load._data) delete clippy.load._data[agentName];
      if (clippy.load._sounds) delete clippy.load._sounds[agentName];
      if (clippy.load._maps) delete clippy.load._maps[agentPath];
    } catch {}

    // Pre-resolve sounds deferred — clippyjs _loadScript has NO onerror handler,
    // so if sounds-mp3.js fails to load/parse, the deferred hangs forever and
    // $.when(map, agent, sounds) NEVER completes (neither success nor fail fires).
    // This bypasses sounds loading entirely, preventing silent infinite hangs.
    try {
      clippy.load._sounds[agentName] = $.Deferred().resolve({});
    } catch {}

    loadAttemptRef.current++;
    const thisAttempt = loadAttemptRef.current;

    let loadCompleted = false;

    // Safety timeout — if clippyjs hangs (e.g. agent.js script fails with no
    // onerror handler), force fallback instead of silently failing forever
    const loadTimeout = setTimeout(() => {
      if (loadCompleted || thisAttempt !== loadAttemptRef.current) return;
      loadCompleted = true;
      if (agentName !== 'Clippy') {
        loadAgent('Clippy');
      }
    }, 8000);

    clippy.load(agentName, (agent) => {
      clearTimeout(loadTimeout);
      // Ignore if a newer load was triggered
      if (loadCompleted || thisAttempt !== loadAttemptRef.current) return;
      loadCompleted = true;

      agentRef.current = agent;
      setLoaded(true);

      agent.moveTo(window.innerWidth - 200, window.innerHeight - 180);
      agent.show();

      try { agent.play('Greeting'); } catch {}

      // First message after greeting animation
      setTimeout(() => {
        if (thisAttempt !== loadAttemptRef.current) return;
        if (!isWalletConnected()) {
          agent.speak(WELCOME_MSG);
        } else {
          agent.speak(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
        }
        try { agent.animate(); } catch {}
      }, 1500);
    }, () => {
      clearTimeout(loadTimeout);
      // Fallback to Clippy if specific agent fails
      if (!loadCompleted && agentName !== 'Clippy' && thisAttempt === loadAttemptRef.current) {
        loadCompleted = true;
        loadAgent('Clippy');
      }
    }, CLIPPY_CDN);
  }, []);

  // Load immediately
  useEffect(() => {
    const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
    if (!enabled) return;

    loadAgent(getAgentName());

    return () => {
      if (agentRef.current) {
        try { agentRef.current.hide(true, () => {}); } catch {}
        agentRef.current = null;
      }
      $('.clippy, .clippy-balloon').remove();
    };
  }, [loadAgent, getAgentName]);

  // Periodic messages
  useEffect(() => {
    if (!loaded) return;

    const interval = setInterval(() => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled || !agentRef.current) return;

      const msg = MESSAGES[messageIndexRef.current % MESSAGES.length];
      messageIndexRef.current++;

      agentRef.current.speak(msg);
      try { agentRef.current.animate(); } catch {}
    }, 60000 + Math.random() * 60000);

    return () => clearInterval(interval);
  }, [loaded]);

  // Listen for mint events — congratulate the user
  useEffect(() => {
    const MINT_MESSAGES = [
      (d) => `You just hired a ${d.species || 'mysterious entity'} ${(d.archetype || 'developer').replace(/_/g, ' ')}. Bold choice. Very bold.`,
      (d) => `Another soul for ${(d.corporation || 'the corporation').replace(/_/g, ' ')}! The shareholders will be pleased.`,
      (d) => `${d.name || 'Your new dev'} has entered the simulation. May the bugs be ever in their favor.`,
      (d) => `Congratulations! You've hired a digital wage slave. I mean, a talented developer. ${d.name || 'They'}'re very excited. Well, as excited as code can be.`,
      (d) => `${d.name || 'New hire'} reporting for duty at ${(d.corporation || 'HQ').replace(/_/g, ' ')}! Their first assignment: figure out what they're supposed to do.`,
      (d) => `A new ${(d.archetype || 'developer').replace(/_/g, ' ')} joins the Protocol Wars! ${d.name || 'They'} already regrets this career choice.`,
      (d) => `Welcome, ${d.name || 'new dev'}! Your developer has been assigned a desk, a dream, and a crippling sense of corporate obligation.`,
      (d) => `${d.name || 'Your new dev'} is now property of ${(d.corporation || 'the corporation').replace(/_/g, ' ')}. Please do not form emotional attachments. Too late? Too late.`,
      (d) => `I've seen many ${(d.archetype || 'developer').replace(/_/g, ' ')}s come and go. Mostly go. Good luck, ${d.name || 'new hire'}!`,
      (d) => `${d.name || 'A brave soul'} has been deployed. Current survival odds: non-zero. That's the best we can offer.`,
    ];

    const handleDevHired = (e) => {
      const { dev } = e.detail || {};
      if (!dev || !agentRef.current) return;

      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled) return;

      const msgFn = MINT_MESSAGES[Math.floor(Math.random() * MINT_MESSAGES.length)];
      const msg = msgFn(dev);

      // Small delay so it doesn't overlap with other speech
      setTimeout(() => {
        if (agentRef.current) {
          try { agentRef.current.play('Congratulate'); } catch {
            try { agentRef.current.animate(); } catch {}
          }
          agentRef.current.speak(msg);
        }
      }, 2000);
    };

    window.addEventListener('nx-dev-hired', handleDevHired);
    return () => window.removeEventListener('nx-dev-hired', handleDevHired);
  }, []);

  // Poll for unread notifications and announce them
  useEffect(() => {
    if (!loaded) return;

    const seenNotifs = new Set(JSON.parse(localStorage.getItem('nx-assistant-seen-notifs') || '[]'));

    const pollNotifications = () => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled || !agentRef.current) return;

      const wallet = window.ethereum?.selectedAddress;
      if (!wallet) return;

      api.getNotifications(wallet, true)
        .then(notifs => {
          if (!Array.isArray(notifs) || notifs.length === 0) return;
          // Find first unseen notification
          const unseen = notifs.find(n => !seenNotifs.has(n.id));
          if (!unseen) return;

          seenNotifs.add(unseen.id);
          // Keep only last 200 seen IDs
          const arr = [...seenNotifs];
          if (arr.length > 200) arr.splice(0, arr.length - 200);
          localStorage.setItem('nx-assistant-seen-notifs', JSON.stringify(arr));

          const msg = `${unseen.title}\n\n${unseen.body.slice(0, 150)}`;
          try { agentRef.current.play('Alert'); } catch {
            try { agentRef.current.animate(); } catch {}
          }
          agentRef.current.speak(msg);
        })
        .catch(() => {});
    };

    const interval = setInterval(pollNotifications, 30000);
    // Initial check after 10s
    const timeout = setTimeout(pollNotifications, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [loaded]);

  // Listen for agent change events
  useEffect(() => {
    const handleSettingsChanged = () => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled) {
        if (agentRef.current) {
          try { agentRef.current.hide(true, () => {}); } catch {}
          agentRef.current = null;
          $('.clippy, .clippy-balloon').remove();
        }
        setLoaded(false);
        return;
      }

      const newAgent = getAgentName();
      loadAgent(newAgent);
    };

    window.addEventListener('nx-assistant-changed', handleSettingsChanged);
    return () => window.removeEventListener('nx-assistant-changed', handleSettingsChanged);
  }, [loadAgent, getAgentName]);

  return null;
}
