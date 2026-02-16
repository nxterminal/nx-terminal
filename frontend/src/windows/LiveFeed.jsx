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
  default: '>',
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

function generateProceduralMessage() {
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
