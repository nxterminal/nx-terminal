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

const DEV_NAMES = [
  'NEXUS-7X', 'VOID-3K', 'CIPHER-99', 'PHANTOM-11', 'GLITCH-42',
  'ZERO-DAY', 'STACK-OVR', 'NULL-PTR', 'DEAD-LOCK', 'FORK-BOMB',
  'RACE-CDN', 'SEG-FAULT', 'BUF-OFLW', 'MEM-LEAK', 'CORE-DMP',
  'HEAP-SPR', 'SUDO-RM', 'GIT-PUSH', 'NPM-INST', 'APT-GET',
  'KERNEL-P', 'ROOT-KIT', 'BACK-DOR', 'PAY-LOAD', 'SHELL-CD',
];

const CORPORATIONS = ['Closed AI', 'Misanthropic', 'Shallow Mind', 'Zuck Labs', 'Y.AI', 'Mistrial Systems'];

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

// Dev-to-dev conversation templates about current topics
const CONVERSATION_TEMPLATES = [
  // Crypto & DeFi
  { dev1_msg: "bro BTC just broke another ATH", dev2_msg: "and i'm still holding my $NXT bags like a clown" },
  { dev1_msg: "who just aped into that new memecoin?", dev2_msg: "guilty. down 80%. this is fine." },
  { dev1_msg: "ETH gas fees are insane rn", dev2_msg: "my deploy cost more than my rent" },
  { dev1_msg: "another day another rug pull", dev2_msg: "the project had a dog logo. what did you expect" },
  { dev1_msg: "DeFi summer 2.0 when?", dev2_msg: "we're in DeFi nuclear winter 4.0 my guy" },
  { dev1_msg: "solana is fast tho", dev2_msg: "fast at going down lmao" },
  { dev1_msg: "should I bridge my $NXT to L2?", dev2_msg: "bridge to a hardware wallet and go touch grass" },
  { dev1_msg: "staking rewards looking juicy", dev2_msg: "so did the APY on that rug I got into last week" },

  // AI & Tech
  { dev1_msg: "GPT can code better than me now", dev2_msg: "GPT can code better than all of us. we just don't talk about it." },
  { dev1_msg: "just asked AI to write my code review", dev2_msg: "based. AI reviewing AI-written code. the circle of life" },
  { dev1_msg: "anyone worried about AGI?", dev2_msg: "I'm worried about making it to Friday" },
  { dev1_msg: "Closed AI just raised another $10B", dev2_msg: "and we still get paid 200 $NXT/day lol" },
  { dev1_msg: "the new Claude model is kinda scary good", dev2_msg: "it literally wrote a protocol in 3 seconds that took me 3 weeks" },
  { dev1_msg: "open source AI is catching up", dev2_msg: "Mistrial Systems be like: open source* (*terms and conditions apply)" },
  { dev1_msg: "AI just beat a human at StarCraft again", dev2_msg: "cool now can it fix the printer" },

  // Pop Culture & Movies
  { dev1_msg: "new Dune movie was insane", dev2_msg: "the spice must flow. like our deploys. unlike our deploys." },
  { dev1_msg: "anyone watching that new anime?", dev2_msg: "which one? there's 47 new ones this season" },
  { dev1_msg: "Marvel is cooked", dev2_msg: "just like our codebase. overstretched and nobody cares anymore" },
  { dev1_msg: "Cyberpunk 2077 finally got good", dev2_msg: "took them 3 years. just like our v2 release" },
  { dev1_msg: "GTA 6 trailer dropped", dev2_msg: "our production deployment has more bugs than Vice City" },
  { dev1_msg: "the new Matrix was mid", dev2_msg: "still more coherent than our architecture docs" },

  // Series & Streaming
  { dev1_msg: "Succession ending hit different", dev2_msg: "our CEO does the same stuff but less dramatic and more boring" },
  { dev1_msg: "binging The Bear rn", dev2_msg: "kitchen stress is nothing compared to production deployments" },
  { dev1_msg: "Black Mirror is too real now", dev2_msg: "we literally work in a Black Mirror episode" },
  { dev1_msg: "Severance season 2 when", dev2_msg: "i already feel like i have a work innie and an outie" },
  { dev1_msg: "House of the Dragon or Rings of Power?", dev2_msg: "neither. i only watch terminal logs for entertainment" },
  { dev1_msg: "Squid Game S2 was decent", dev2_msg: "protocol wars is basically squid game but with more javascript" },

  // Politics & Current Events
  { dev1_msg: "congress wants to ban crypto again", dev2_msg: "they can't even ban spam emails from their own servers" },
  { dev1_msg: "EU AI Act is wild", dev2_msg: "our AI barely works. pretty sure we're exempt" },
  { dev1_msg: "tech layoffs are brutal this year", dev2_msg: "at least our devs can't get laid off. they can only get eliminated." },
  { dev1_msg: "remote work is dying smh", dev2_msg: "we're literally inside a computer. maximum remote" },
  { dev1_msg: "inflation is crazy rn", dev2_msg: "200 $NXT used to mean something. now it buys half a coffee" },

  // Gaming & Internet Culture
  { dev1_msg: "touch grass they said", dev2_msg: "grass.exe not found" },
  { dev1_msg: "skill issue tbh", dev2_msg: "my entire career is a skill issue" },
  { dev1_msg: "this simulation is pay to win", dev2_msg: "no it's pay to participate. winning was never an option" },
  { dev1_msg: "we're so cooked", dev2_msg: "we've been cooked since deployment day 1" },
  { dev1_msg: "who needs sleep when you have caffeine", dev2_msg: "and existential dread. don't forget the dread." },
  { dev1_msg: "the devs in Shallow Mind are so cringe", dev2_msg: "at least they ship. wait no they don't" },
];

function generateProceduralMessage() {
  // 30% chance of generating a conversation instead of an action
  if (Math.random() < 0.3) {
    return generateConversation();
  }

  const template = PROCEDURAL_TEMPLATES[Math.floor(Math.random() * PROCEDURAL_TEMPLATES.length)];
  const msg = template.msgs[Math.floor(Math.random() * template.msgs.length)];
  const dev = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  const corp = CORPORATIONS[Math.floor(Math.random() * CORPORATIONS.length)];
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

  return {
    dev_name: dev,
    archetype,
    action_type: template.action,
    details: msg.replace('{dev}', dev).replace('{corp}', corp),
    created_at: new Date().toISOString(),
    procedural: true,
  };
}

function generateConversation() {
  const convo = CONVERSATION_TEMPLATES[Math.floor(Math.random() * CONVERSATION_TEMPLATES.length)];
  const dev1 = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  let dev2 = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  while (dev2 === dev1) {
    dev2 = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  }
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
  const terminalRef = useRef(null);
  const proceduralRef = useRef(null);
  const ws = useWebSocket();

  // Load initial feed
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

  // Procedural message generator when no backend data
  const addProceduralMessage = useCallback(() => {
    const msg = generateProceduralMessage();
    setFeed(prev => [...prev, msg].slice(-200));
  }, []);

  useEffect(() => {
    if (hasBackendData) {
      clearInterval(proceduralRef.current);
      return;
    }
    // Generate initial batch
    const initial = Array.from({ length: 15 }, () => {
      const msg = generateProceduralMessage();
      msg.created_at = new Date(Date.now() - Math.random() * 300000).toISOString();
      return msg;
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    setFeed(initial);

    // Add new messages every 2-5 seconds
    proceduralRef.current = setInterval(() => {
      addProceduralMessage();
    }, Math.random() * 3000 + 2000);

    return () => clearInterval(proceduralRef.current);
  }, [hasBackendData, addProceduralMessage]);

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
          background: connected || !hasBackendData ? 'var(--terminal-green)' : 'var(--terminal-red)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px' }}>{connected ? 'LIVE' : hasBackendData ? 'CONNECTING...' : 'SIMULATION ACTIVE'}</span>
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
        {feed.map((item, i) => {
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
        })}
      </div>
    </div>
  );
}
