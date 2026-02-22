import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444',
  'LURKER': '#808080',
  'DEGEN': '#ffd700',
  'GRINDER': '#4488ff',
  'INFLUENCER': '#ff44ff',
  'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00',
  'SCRIPT_KIDDIE': '#00ffff',
};

const ACTION_ICONS = {
  code: '>>', trade: '$', chat: '#', hack: '!',
  create_protocol: '+', invest: '%', create_ai: '*', mint: '@',
  sabotage: '!!', debug: '~~', deploy: '=>', coffee: '::',
  conversation: '#', default: '>',
};

const ARCHETYPES = Object.keys(ARCHETYPE_COLORS);

const FALLBACK_DEV_NAMES = [
  'NEXUS-7X', 'VOID-3K', 'CIPHER-99', 'PHANTOM-11', 'GLITCH-42',
  'ZERO-DAY', 'STACK-OVR', 'NULL-PTR', 'DEAD-LOCK', 'FORK-BOMB',
  'RACE-CDN', 'SEG-FAULT', 'BUF-OFLW', 'MEM-LEAK', 'CORE-DMP',
  'HEAP-SPR', 'SUDO-RM', 'GIT-PUSH', 'NPM-INST', 'APT-GET',
  'KERNEL-P', 'ROOT-KIT', 'BACK-DOR', 'PAY-LOAD', 'SHELL-CD',
];

const FALLBACK_CORPORATIONS = ['Closed AI', 'Misanthropic', 'Shallow Mind', 'Zuck Labs', 'Y.AI', 'Mistrial Systems'];

// Mutable lists that get replaced with real DB data when available
let DEV_NAMES = [...FALLBACK_DEV_NAMES];
let DEV_CORPS = {};  // name → corporation mapping
let CORPORATIONS = [...FALLBACK_CORPORATIONS];

const PROCEDURAL_TEMPLATES = [
  { action: 'code', msgs: [
    '{dev} pushed 847 lines to {corp} mainframe. 846 were comments.',
    '{dev} refactored legacy code. It is now legacy code with different variable names.',
    '{dev} deployed hotfix #4,217. Created bugs #4,218 through #4,225.',
    '{dev} wrote a function that calls itself. Philosophically.',
    '{dev} committed directly to production. Prayers were offered.',
  ]},
  { action: 'trade', msgs: [
    '{dev} sold 500 $NXT for feelings of brief superiority.',
    '{dev} bought the dip. The dip kept dipping.',
    '{dev} invested in {corp} futures. The future looks bleak.',
    '{dev} liquidated portfolio. Portfolio liquidated {dev} back.',
    '{dev} made a trade so bad it crashed the simulation for 3 seconds.',
  ]},
  { action: 'hack', msgs: [
    '{dev} attempted to hack {corp}. Firewall responded with a strongly worded email.',
    '{dev} found a zero-day exploit. Used it to change the office thermostat.',
    '{dev} breached {corp} security. Stole 40TB of unread Slack messages.',
    '{dev} launched DDoS attack. Target was already down. Took credit anyway.',
    '{dev} installed a backdoor in {corp}. The backdoor has better UX than the front door.',
  ]},
  { action: 'sabotage', msgs: [
    '{dev} sabotaged a competitor by complimenting their code. They spent 3 hours looking for the trap.',
    '{dev} replaced {corp} production database with a spreadsheet. Nobody noticed for 2 days.',
    '{dev} leaked {corp} roadmap. It was just the word "pivot" written 47 times.',
    '{dev} filed a fake bug report on {corp}. It was accidentally a real bug.',
  ]},
  { action: 'create_protocol', msgs: [
    '{dev} created protocol "DarkSwap v3". Immediately deprecated v1 and v2.',
    '{dev} launched a new protocol. VC funding secured before the README was written.',
    '{dev} forked {corp} protocol. Added nothing. Called it "innovation".',
    '{dev} created a protocol that does what 3 others do, but worse and with more dependencies.',
  ]},
  { action: 'coffee', msgs: [
    '{dev} consumed 7th coffee of the hour. Heart rate now measured in GHz.',
    '{dev} discovered the coffee machine gained sentience. They bonded over shared hatred of Mondays.',
    '{dev} traded 200 $NXT for premium coffee beans. Productivity unchanged. Vibes improved.',
  ]},
  { action: 'debug', msgs: [
    '{dev} spent 4 hours debugging. The bug was a missing semicolon. In a YAML file.',
    '{dev} fixed a bug by adding a comment that says "do not remove this line".',
    '{dev} debugged {corp} codebase. Found 3 bugs. Introduced 7 new ones. Net progress: -4.',
  ]},
  { action: 'deploy', msgs: [
    '{dev} deployed to production on a Friday. Emergency meeting scheduled for Saturday.',
    '{dev} deployed {corp} update. Rollback initiated 4 seconds later. New record.',
    '{dev} deployed 200MB of node_modules to production. System groaned audibly.',
  ]},
];

// Chaos templates — unlocked at higher dev counts for escalating madness
const CHAOS_TEMPLATES = [
  { action: 'sabotage', minDevs: 3, msgs: [
    '{dev} and {dev2} started a turf war over the same Git branch. Casualties: 47 merge conflicts.',
    '{dev} sold {corp} access credentials for 3 $NXT and a coffee. The buyer was an intern.',
    '{dev} overwrote the entire {corp} codebase with a single print statement. Output: "lol".',
    '{dev} started a mutiny. 4 devs defected to {corp}. They were sent back within the hour.',
  ]},
  { action: 'hack', minDevs: 5, msgs: [
    'ALERT: {dev} triggered a cascade failure across {corp}. All systems nominal. Nobody knows why.',
    '{dev} accidentally created a self-replicating protocol. It is now 40% of all network traffic.',
    '{dev} hacked into the simulation itself. Found a TODO comment from the developers: "fix this later".',
    'CRITICAL: {dev} discovered {corp} has been running on a single Raspberry Pi this entire time.',
  ]},
  { action: 'deploy', minDevs: 8, msgs: [
    'EMERGENCY: {dev} deployed an update that makes all other devs speak in reverse. gnihton si gnihtyreve.',
    '{dev} created an AI that creates AIs that create AIs. HR is concerned.',
    'NOTICE: {dev} achieved sentience for 0.3 seconds. Used the time to file a complaint about the coffee.',
    '{dev} merged 200 pull requests simultaneously. The resulting code achieved consciousness briefly.',
    'WARNING: {dev} divided by zero. The simulation hiccupped. Time skipped forward by 2 cycles.',
  ]},
  { action: 'sabotage', minDevs: 10, msgs: [
    'MELTDOWN: All devs from {corp} went on strike. They demand better variable names.',
    'PARADOX: {dev} deleted themselves from the database. They are still here. Nobody can explain this.',
    'BREACH: {dev} accessed the admin panel. Changed the simulation speed to 10x. Chaos ensued.',
    'ANOMALY: {dev} and 7 other devs formed a rogue collective. They call themselves "sudo rm -rf".',
  ]},
];

const CONVERSATION_TEMPLATES = [
  { dev1_msg: "bro BTC just broke another ATH", dev2_msg: "and i'm still holding my $NXT bags like a clown" },
  { dev1_msg: "who just aped into that new memecoin?", dev2_msg: "guilty. down 80%. this is fine." },
  { dev1_msg: "ETH gas fees are insane rn", dev2_msg: "my deploy cost more than my rent" },
  { dev1_msg: "another day another rug pull", dev2_msg: "the project had a dog logo. what did you expect" },
  { dev1_msg: "DeFi summer 2.0 when?", dev2_msg: "we're in DeFi nuclear winter 4.0 my guy" },
  { dev1_msg: "solana is fast tho", dev2_msg: "fast at going down lmao" },
  { dev1_msg: "should I bridge my $NXT to L2?", dev2_msg: "bridge to a hardware wallet and go touch grass" },
  { dev1_msg: "staking rewards looking juicy", dev2_msg: "so did the APY on that rug I got into last week" },
  { dev1_msg: "GPT can code better than me now", dev2_msg: "GPT can code better than all of us. we just don't talk about it." },
  { dev1_msg: "just asked AI to write my code review", dev2_msg: "based. AI reviewing AI-written code. the circle of life" },
  { dev1_msg: "anyone worried about AGI?", dev2_msg: "I'm worried about making it to Friday" },
  { dev1_msg: "Closed AI just raised another $10B", dev2_msg: "and we still get paid 200 $NXT/day lol" },
  { dev1_msg: "the new Claude model is kinda scary good", dev2_msg: "it literally wrote a protocol in 3 seconds that took me 3 weeks" },
  { dev1_msg: "open source AI is catching up", dev2_msg: "Mistrial Systems be like: open source* (*terms and conditions apply)" },
  { dev1_msg: "AI just beat a human at StarCraft again", dev2_msg: "cool now can it fix the printer" },
  { dev1_msg: "new Dune movie was insane", dev2_msg: "the spice must flow. like our deploys. unlike our deploys." },
  { dev1_msg: "anyone watching that new anime?", dev2_msg: "which one? there's 47 new ones this season" },
  { dev1_msg: "Marvel is cooked", dev2_msg: "just like our codebase. overstretched and nobody cares anymore" },
  { dev1_msg: "Cyberpunk 2077 finally got good", dev2_msg: "took them 3 years. just like our v2 release" },
  { dev1_msg: "GTA 6 trailer dropped", dev2_msg: "our production deployment has more bugs than Vice City" },
  { dev1_msg: "the new Matrix was mid", dev2_msg: "still more coherent than our architecture docs" },
  { dev1_msg: "Succession ending hit different", dev2_msg: "our CEO does the same stuff but less dramatic and more boring" },
  { dev1_msg: "binging The Bear rn", dev2_msg: "kitchen stress is nothing compared to production deployments" },
  { dev1_msg: "Black Mirror is too real now", dev2_msg: "we literally work in a Black Mirror episode" },
  { dev1_msg: "Severance season 2 when", dev2_msg: "i already feel like i have a work innie and an outie" },
  { dev1_msg: "House of the Dragon or Rings of Power?", dev2_msg: "neither. i only watch terminal logs for entertainment" },
  { dev1_msg: "Squid Game S2 was decent", dev2_msg: "protocol wars is basically squid game but with more javascript" },
  { dev1_msg: "congress wants to ban crypto again", dev2_msg: "they can't even ban spam emails from their own servers" },
  { dev1_msg: "EU AI Act is wild", dev2_msg: "our AI barely works. pretty sure we're exempt" },
  { dev1_msg: "tech layoffs are brutal this year", dev2_msg: "at least our devs can't get laid off. they can only get eliminated." },
  { dev1_msg: "remote work is dying smh", dev2_msg: "we're literally inside a computer. maximum remote" },
  { dev1_msg: "inflation is crazy rn", dev2_msg: "200 $NXT used to mean something. now it buys half a coffee" },
  { dev1_msg: "touch grass they said", dev2_msg: "grass.exe not found" },
  { dev1_msg: "skill issue tbh", dev2_msg: "my entire career is a skill issue" },
  { dev1_msg: "this simulation is pay to win", dev2_msg: "no it's pay to participate. winning was never an option" },
  { dev1_msg: "we're so cooked", dev2_msg: "we've been cooked since deployment day 1" },
  { dev1_msg: "who needs sleep when you have caffeine", dev2_msg: "and existential dread. don't forget the dread." },
  { dev1_msg: "the devs in Shallow Mind are so cringe", dev2_msg: "at least they ship. wait no they don't" },
];

function pickDev() {
  const name = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  const corp = DEV_CORPS[name] || CORPORATIONS[Math.floor(Math.random() * CORPORATIONS.length)];
  return { name, corp };
}

function generateProceduralMessage(devCount) {
  // Conversation chance increases with dev count (20% base up to 40%)
  const convChance = Math.min(0.4, 0.2 + devCount * 0.02);
  if (Math.random() < convChance) {
    return generateConversation();
  }

  // Include chaos templates based on dev count
  const availableChaos = CHAOS_TEMPLATES.filter(t => devCount >= t.minDevs);
  const allTemplates = [...PROCEDURAL_TEMPLATES, ...availableChaos];

  const template = allTemplates[Math.floor(Math.random() * allTemplates.length)];
  const msg = template.msgs[Math.floor(Math.random() * template.msgs.length)];
  const d1 = pickDev();
  let d2 = pickDev();
  while (d2.name === d1.name && DEV_NAMES.length > 1) d2 = pickDev();
  const corp = d1.corp;
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

  return {
    dev_name: d1.name,
    archetype,
    action_type: template.action,
    details: msg.replace('{dev}', d1.name).replace('{dev2}', d2.name).replace('{corp}', corp),
    created_at: new Date().toISOString(),
    procedural: true,
  };
}

function generateConversation() {
  const convo = CONVERSATION_TEMPLATES[Math.floor(Math.random() * CONVERSATION_TEMPLATES.length)];
  const d1 = pickDev();
  let d2 = pickDev();
  while (d2.name === d1.name && DEV_NAMES.length > 1) d2 = pickDev();
  const dev1 = d1.name;
  const dev2 = d2.name;
  const arch1 = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  const arch2 = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

  return {
    dev_name: dev1,
    archetype: arch1,
    action_type: 'conversation',
    details: convo.dev1_msg,
    reply_dev: dev2,
    reply_archetype: arch2,
    reply_msg: convo.dev2_msg,
    created_at: new Date().toISOString(),
    procedural: true,
    isConversation: true,
  };
}

// Calculate message interval based on dev count: more devs = faster + more chaotic
function getMessageInterval(devCount) {
  if (devCount <= 1) return 6000 + Math.random() * 4000;  // 6-10s
  if (devCount <= 3) return 4000 + Math.random() * 3000;  // 4-7s
  if (devCount <= 5) return 2500 + Math.random() * 2500;  // 2.5-5s
  if (devCount <= 8) return 1500 + Math.random() * 2000;  // 1.5-3.5s
  return 800 + Math.random() * 1200;                       // 0.8-2s (chaos)
}

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function LiveFeed() {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);
  const [mintedDevs, setMintedDevs] = useState(
    () => parseInt(localStorage.getItem('nx-minted-devs') || '0', 10)
  );
  const terminalRef = useRef(null);
  const proceduralRef = useRef(null);
  const feedInitRef = useRef(false);
  const ws = useWebSocket();

  // Fetch real dev names from DB to replace hardcoded fallbacks
  useEffect(() => {
    api.getDevs({ limit: 200 })
      .then(data => {
        const devList = Array.isArray(data) ? data : (data.devs || []);
        if (devList.length > 0) {
          const realNames = devList.map(d => d.name).filter(Boolean);
          if (realNames.length > 0) {
            DEV_NAMES = realNames;
            DEV_CORPS = {};
            const corpSet = new Set();
            devList.forEach(d => {
              if (d.name && d.corporation) {
                const corpDisplay = d.corporation.replace(/_/g, ' ');
                DEV_CORPS[d.name] = corpDisplay;
                corpSet.add(corpDisplay);
              }
            });
            if (corpSet.size > 0) CORPORATIONS = [...corpSet];
          }
        }
      })
      .catch(() => {});
  }, []);

  // Listen for mint events
  useEffect(() => {
    const handleMint = (e) => {
      setMintedDevs(e.detail.count);
    };
    window.addEventListener('nx-dev-minted', handleMint);
    return () => window.removeEventListener('nx-dev-minted', handleMint);
  }, []);

  // Load initial feed from backend
  useEffect(() => {
    api.getFeed(100)
      .then(data => {
        const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
        if (items.length > 0) {
          setFeed(items.reverse());
          setHasBackendData(true);
        }
      })
      .catch(() => {});
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    setConnected(ws.connected);
    if (ws.messages.length > 0) {
      const latest = ws.messages[0];
      if (latest.type === 'action' || latest.data) {
        setHasBackendData(true);
        setFeed(prev => [...prev, latest.data || latest].slice(-200));
      }
    }
  }, [ws.messages, ws.connected]);

  // Procedural message generator — only active after first mint, no backend data
  const addProceduralMessage = useCallback(() => {
    const msg = generateProceduralMessage(mintedDevs);
    setFeed(prev => [...prev, msg].slice(-200));
  }, [mintedDevs]);

  useEffect(() => {
    if (hasBackendData) {
      clearTimeout(proceduralRef.current);
      return;
    }

    // No devs minted yet — stay empty
    if (mintedDevs === 0) {
      clearTimeout(proceduralRef.current);
      return;
    }

    // First activation after mint — generate a small initial burst
    if (!feedInitRef.current) {
      feedInitRef.current = true;
      const burstSize = Math.min(5 + mintedDevs * 2, 20);
      const initial = Array.from({ length: burstSize }, () => {
        const msg = generateProceduralMessage(mintedDevs);
        msg.created_at = new Date(Date.now() - Math.random() * 60000).toISOString();
        return msg;
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setFeed(initial);
    }

    // Schedule messages at a rate that scales with dev count
    const scheduleNext = () => {
      proceduralRef.current = setTimeout(() => {
        addProceduralMessage();
        scheduleNext();
      }, getMessageInterval(mintedDevs));
    };
    scheduleNext();

    return () => clearTimeout(proceduralRef.current);
  }, [hasBackendData, mintedDevs, addProceduralMessage]);

  // Auto-scroll
  useEffect(() => {
    if (!scrollLock && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [feed, scrollLock]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '2px 4px', display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--win-bg)' }}>
        <span style={{
          width: 8, height: 8, borderRadius: 0,
          background: connected || (!hasBackendData && mintedDevs > 0) ? 'var(--terminal-green)' : mintedDevs === 0 ? 'var(--border-dark)' : 'var(--terminal-red)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px' }}>
          {connected ? 'LIVE' : hasBackendData ? 'CONNECTING...' : mintedDevs > 0 ? `SIMULATION ACTIVE -- ${mintedDevs} dev${mintedDevs !== 1 ? 's' : ''} deployed` : 'AWAITING FIRST DEPLOYMENT'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="win-btn"
          onClick={() => setScrollLock(s => !s)}
          style={{ fontSize: '10px', padding: '1px 6px' }}
        >
          {scrollLock ? 'Scroll: LOCKED' : 'Scroll: AUTO'}
        </button>
      </div>
      <div className="terminal" ref={terminalRef} style={{ flex: 1 }}>
        {mintedDevs === 0 && feed.length === 0 && !hasBackendData ? (
          <div style={{ padding: '20px', color: 'var(--terminal-amber)', fontFamily: "'VT323', monospace" }}>
            <div style={{ marginBottom: '12px', fontSize: '16px' }}>{'>'} LIVE FEED -- INACTIVE</div>
            <div style={{ color: '#666', fontSize: '14px', lineHeight: 1.6 }}>
              No developers deployed yet.
              <br />
              <br />
              Open "Mint/Hire Devs" from your desktop to deploy your first developer.
              <br />
              Once deployed, your devs will begin coding, trading, hacking, and causing
              <br />
              general chaos across the simulation. All activity will appear here in real-time.
              <br />
              <br />
              More devs = more activity = more chaos.
            </div>
          </div>
        ) : (
          feed.map((item, i) => {
            const archetype = item.archetype || '';
            const color = ARCHETYPE_COLORS[archetype] || 'var(--terminal-green)';
            const icon = ACTION_ICONS[item.action_type] || ACTION_ICONS.default;
            const isNew = i === feed.length - 1;

            // Conversation rendering
            if (item.isConversation) {
              const replyColor = ARCHETYPE_COLORS[item.reply_archetype] || 'var(--terminal-green)';
              return (
                <div key={i} className={`terminal-line${isNew ? ' new' : ''}`}>
                  <span style={{ color: 'var(--terminal-amber)' }}>
                    [{formatTime(item.created_at)}]
                  </span>{' '}
                  <span style={{ color: 'var(--terminal-cyan)' }}>#</span>{' '}
                  <span style={{ color, fontWeight: 'bold' }}>
                    {item.dev_name}
                  </span>{' '}
                  <span style={{ color: '#aaa' }}>said:</span>{' '}
                  <span style={{ color: 'var(--terminal-green)' }}>
                    "{item.details}"
                  </span>
                  <br />
                  <span style={{ color: 'var(--terminal-amber)' }}>
                    {'           '}
                  </span>{' '}
                  <span style={{ color: 'var(--terminal-cyan)' }}>{'\u2514\u2500'}</span>{' '}
                  <span style={{ color: replyColor, fontWeight: 'bold' }}>
                    {item.reply_dev}
                  </span>{' '}
                  <span style={{ color: '#aaa' }}>replied:</span>{' '}
                  <span style={{ color: 'var(--terminal-green)' }}>
                    "{item.reply_msg}"
                  </span>
                </div>
              );
            }

            return (
              <div key={i} className={`terminal-line${isNew ? ' new' : ''}`}>
                <span style={{ color: 'var(--terminal-amber)' }}>
                  [{formatTime(item.created_at)}]
                </span>{' '}
                <span style={{ color: 'var(--terminal-cyan)' }}>{icon}</span>{' '}
                <span style={{ color, fontWeight: 'bold' }}>
                  {item.dev_name || 'Unknown'}
                </span>{' '}
                <span style={{ color: 'var(--border-dark)' }}>
                  ({archetype || '???'})
                </span>{' '}
                {item.procedural ? (
                  <span style={{ color: 'var(--terminal-green)' }}>
                    {item.details}
                  </span>
                ) : (
                  <>
                    <span style={{ color: 'var(--terminal-green)' }}>
                      {item.action_type || 'action'}
                    </span>{' '}
                    <span style={{ color: '#aaa' }}>
                      {item.details || ''}
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
