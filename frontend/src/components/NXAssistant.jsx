import { useState, useEffect, useRef, useCallback } from 'react';
import $ from 'jquery';
import clippy from 'clippyjs';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

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
  // ── Original classics ──
  "It looks like you're trying to win the Protocol Wars. Would you like help?",
  'Your developer has been staring at their screen for 3 hours. This is normal.',
  'TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.',
  "I see you haven't collected your salary. It's not going anywhere. Neither are you.",
  'Did you know? 73% of protocols fail in their first week. The other 27% fail in their second week.',
  "It looks like you're writing a protocol. Would you like me to add more bugs?",
  "I noticed you haven't opened the Leaderboard in a while. Your competitors are thriving. You are not.",
  'BREAKING: Local developer claims their code works on their machine. Nobody else can confirm.',
  "According to my calculations, you have a 0.3% chance of winning. That's up from yesterday!",
  'The AI Lab is running at peak capacity. It is also on fire. This is fine.',
  'Remember: In the Protocol Wars, the real exploit was the friends we made along the way.',
  "I've been monitoring your clicks. You seem stressed. Have you tried closing this dialog?",
  'Your developer portfolio is performing exactly as expected. Expectations were low.',
  'The blockchain is immutable. Your poor decisions, however, are not.',
  'ALERT: Someone on World Chat claims to be profitable. Investigation pending.',
  'Fun fact: The term "bug" comes from actual insects in old computers. Your bugs are much worse.',
  'I see you changed the wallpaper. Nice. That will definitely help with the Protocol Wars.',
  "Your inbox has unread messages. They're mostly disappointment.",
  'Have you tried turning your developers off and on again?',
  'The market is volatile. By which I mean it exists.',
  "I'd suggest investing in DeFi but I'm legally required not to give financial advice. So definitely invest in DeFi.",
  'Your developer just pushed to main without testing. Bold strategy.',
  'ChatGPT thinks it could beat your developers. ChatGPT is probably right.',
  'The SEC would like to know your location. Just kidding. Maybe.',
  'Your NFT is now worth exactly one memory. A fond one, hopefully.',
  'A whale just dumped. Your developers are now worth negative vibes.',
  'Remember when Bitcoin was $100? Neither do your developers. They were not yet minted.',
  'The real utility of your NFT is the gas fees you spent along the way.',

  // ── MegaETH ──
  'MegaETH processes blocks faster than your dev writes bugs. Impressive.',
  'Fun fact: MegaETH does 100k+ TPS. Your dev does 3 lines of code per hour. Who\'s the real machine?',
  'Running on MegaETH means your hacks settle in milliseconds. The future is fast.',
  'Your $NXT salary arrives on MegaETH faster than your morning coffee.',
  "MegaETH's real-time blockchain means your dev's salary is always on time. Unlike your last job.",
  'Built different. Built on MegaETH.',
  "Other chains: 'we're fast.' MegaETH: *already processed 10,000 transactions while they were talking*",
  'Your dev just earned 9 $NXT. On MegaETH, that transaction cost less than a thought.',
  "MegaETH: where transactions are faster than your dev's coffee break.",
  "The simulation runs on MegaETH because we needed a chain that doesn't sleep. Just like your devs.",
  'Gas fees on other chains could buy your dev lunch. On MegaETH, not even a crumb.',

  // ── Crypto culture ──
  "Another day, another rug pull somewhere. At least YOUR devs are still working.",
  "CT is fighting about L1 vs L2 again. Meanwhile, your dev just shipped a protocol.",
  "Someone on Twitter said 'blockchain is dead.' Your dev earned 200 $NXT today. Who's dead?",
  "'We're still early' — every crypto person since 2013.",
  "The market is red. Your dev doesn't care. He gets paid in $NXT regardless.",
  'Somewhere a VC just invested $50M in a jpeg. Your dev is building actual software.',
  "Your dev's coding skills are more reliable than most stablecoin pegs.",
  "Remember: not your keys, not your devs. Actually wait, these ARE your devs.",
  'The real yield was the bugs we fixed along the way.',
  'Someone just aped into a memecoin named after a dog wearing a hat. Your dev judges silently.',
  "AI agents are the future. Your dev is literally an AI agent. You're already there.",
  'Web3 social? Your dev has more social skills than most CT influencers.',
  "Market down? Perfect time to train your devs. Buy the dip, train the skill.",
  "NFTs are dead, they said. Meanwhile, your dev just earned you 200 $NXT.",
  "The only rug pull here is when your dev's PC Health hits 0.",
  'DeFi summer, NFT winter, AI spring. Your dev works through all seasons.',
  "Your dev has a better work-life balance than 90% of crypto founders.",
  "Decentralization means no one can fire your dev. Not even you. Wait...",
  'Some protocols have TVL. Your dev has LoC. Lines of Code > Total Value Locked.',
  'Breaking: Congress still does not understand crypto. Markets unchanged.',

  // ── Gameplay ──
  "Your dev is running on fumes. Even AI needs fuel. Feed him.",
  "Your dev's code looks like it was written during a hackathon. At 3 AM. Drunk.",
  "Your dev hasn't talked to another human in 72 hours. Sounds like a regular dev to me.",
  'Your dev is sitting on a pile of $NXT like a digital dragon.',
  "Hacked again? Your dev's security is as strong as a 'password123' login.",
  "Your dev is on a mission. Probably complaining about the WiFi there.",
  "Mission in progress. Your dev promised to bring back souvenirs. They won't.",
  'Your dev just pushed to production on a Friday. HR has been notified.',
  "Caffeine levels: dangerous. Productivity: also dangerous. In a good way.",
  'Social skills at rock bottom. Your dev is becoming a true 10x engineer.',
  "With that balance, your dev could start their own protocol. Just saying.",
  "Your dev's hacking skill is scarier than a smart contract audit.",
];

export default function NXAssistant() {
  const { address, isConnected } = useWallet();
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

      // First message after greeting animation.
      // Accept stale closure: welcome message is a snapshot at agent
      // load. If the user connects mid-greeting, the periodic random
      // messages (every 60-120s) take over without wallet checks anyway.
      setTimeout(() => {
        if (thisAttempt !== loadAttemptRef.current) return;
        if (!isConnected) {
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

  // Poll for unread notifications and announce them.
  // Re-keys on [address, isConnected] so polling starts when the user
  // connects mid-session and stops cleanly on disconnect; React fires the
  // cleanup before each re-run so the previous interval/timeout pair is
  // torn down before a new one is scheduled.
  useEffect(() => {
    if (!loaded) return;
    if (!isConnected || !address) return;

    const seenNotifs = new Set(JSON.parse(localStorage.getItem('nx-assistant-seen-notifs') || '[]'));

    const pollNotifications = () => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled || !agentRef.current) return;

      api.getNotifications(address, true)
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
  }, [loaded, address, isConnected]);

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
