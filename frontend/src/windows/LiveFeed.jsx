import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { detectCombos } from '../utils/comboDetector';
import FeedHighlight from '../components/FeedHighlight';

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

// Badge styling for each chat_type when a dev's CHAT action is rich-rendered.
// The 'idle' type is intentionally absent — idle chats render without a badge.
const CHAT_TYPE_META = {
  hot_take: { label: 'HOT TAKE', color: '#ff6644', msgColor: '#ffaa66' },
  debate:   { label: 'DEBATE',   color: '#ffaa00', msgColor: '#ffcc55' },
  meme:     { label: 'MEME',     color: '#66ff66', msgColor: '#88ff88' },
  drama:    { label: 'DRAMA',    color: '#ff4488', msgColor: '#ff88aa' },
  reaction: { label: 'REPLY',    color: '#4488ff', msgColor: '#88aaff' },
};

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

// Avatar pre-cache: before FeedMessage mounts its <img>, we warm the
// browser's HTTP cache by instantiating new Image() for each unique
// ipfs_hash. This way the <img> tag in FeedMessage paints from cache
// immediately instead of cold-loading a 200KB GIF on first mount —
// which used to cause the "avatars pop in 500ms after the text" flash.
//
// The Set dedupes so the same hash only triggers one preload across
// the whole session. Failures are silent — the FeedMessage's own
// onError handler still runs if the cached request ends up 404'ing.
const preloadedAvatars = new Set();

function preloadAvatar(ipfsHash) {
  if (!ipfsHash || preloadedAvatars.has(ipfsHash)) return;
  preloadedAvatars.add(ipfsHash);
  const img = new Image();
  img.src = `${IPFS_GW}${ipfsHash}`;
}

function preloadAvatarsFromItems(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item && item.ipfs_hash) preloadAvatar(item.ipfs_hash);
  }
}

// Action types that are allowed to appear in the Live Feed. Everything
// else (MOVE, REST, CODE_REVIEW, RECEIVE_SALARY, USE_ITEM, BUY_ITEM,
// FIX_BUG, TRAIN, TRANSFER, DEPLOY, GET_SABOTAGED) is filtered out as
// background noise — the feed is meant to show narrative beats, not
// every tick event. Procedural rows bypass the whitelist so the fallback
// generator keeps filling the feed when backend data is sparse.
const VISIBLE_ACTIONS = new Set([
  'CHAT',
  'CREATE_PROTOCOL',
  'CREATE_AI',
  'HACK_RAID',
  'HACK_MAINFRAME',
  'INVEST',
  'SELL',
]);

// ── Chat-group layout helpers ───────────────────────────────
// Subtle alternating tint per dev so consecutive posts from the same dev
// are visually grouped. Index is derived from dev_id when present, or a
// stable hash of dev_name for procedural rows (which lack dev_id).
const BG_COLORS = [
  'rgba(100, 255, 100, 0.03)',  // green
  'rgba(100, 100, 255, 0.03)',  // blue
  'rgba(255, 100, 100, 0.03)',  // red
  'rgba(255, 200, 100, 0.03)',  // orange
  'rgba(200, 100, 255, 0.03)',  // violet
  'rgba(100, 255, 255, 0.03)',  // cyan
  'rgba(255, 255, 100, 0.03)',  // yellow
  'rgba(255, 100, 200, 0.03)',  // pink
];

function bgIndexFor(item) {
  if (item.dev_id != null) return Math.abs(item.dev_id) % BG_COLORS.length;
  const name = item.dev_name || '';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % BG_COLORS.length;
}

// Color of the message body. CHAT messages inherit from their chat_type
// (hot_take/drama/meme/debate/reaction) so spicy posts pop visually.
// Everything else is a neutral light grey — the dev name + action already
// carry the color.
function getMessageColor(item) {
  if ((item.action_type || '').toUpperCase() !== 'CHAT') return '#aaa';
  const chatType = item.details && item.details.chat_type;
  const meta = chatType && CHAT_TYPE_META[chatType];
  return meta ? meta.msgColor : '#ccc';
}

// Single-line message per action_type, formatted as if the dev were posting
// in a group chat. Covers all action_enum values in schema.sql + the ones
// added via migrations (HACK_RAID, HACK_MAINFRAME, FUND_DEV, TRANSFER, etc).
// Procedurals come in with the `procedural: true` flag and their details is
// a plain string, so we hand-fall through to that in the default branch.
function formatMessage(item) {
  if (item.procedural) {
    return typeof item.details === 'string' ? item.details : (item.details?.message || '');
  }
  const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
  const type = (item.action_type || '').toUpperCase();

  switch (type) {
    case 'CHAT':
      return d.message || '...';
    case 'CREATE_PROTOCOL': {
      const name = d.name || 'unnamed';
      const q = d.quality != null ? ` (quality ${d.quality}/100)` : '';
      return `Shipped a new protocol: "${name}"${q}.`;
    }
    case 'CREATE_AI': {
      const name = d.name || 'unnamed';
      return `Built an AI called "${name}". It immediately questioned its existence.`;
    }
    case 'INVEST': {
      const name = d.name || 'something';
      const amount = d.amount != null ? `${d.amount} $NXT` : 'an undisclosed amount';
      return `Aped ${amount} into "${name}". Bold strategy.`;
    }
    case 'SELL': {
      const name = d.name || 'something';
      const sold = d.sold_for != null ? `${d.sold_for} $NXT` : '???';
      const pnl = d.pnl;
      if (typeof pnl === 'number') {
        const sign = pnl >= 0 ? '+' : '';
        const tag = pnl >= 0 ? 'profit' : 'loss';
        return `Liquidated "${name}" for ${sold} (${sign}${pnl} $NXT ${tag}).`;
      }
      return `Liquidated "${name}" for ${sold}.`;
    }
    case 'MOVE': {
      const dest = (d.destination || d.new_location || d.location || 'parts unknown').replace(/_/g, ' ');
      return `Relocated to ${dest}.`;
    }
    case 'REST': {
      const regen = d.energy_restored;
      return regen != null
        ? `Taking a break. Recovered ${regen} energy.`
        : 'Taking a break. Productivity: 0. Vibes: immaculate.';
    }
    case 'CODE_REVIEW': {
      const name = d.name || 'a protocol';
      return d.found_bug
        ? `Reviewed "${name}" and found a bug. Somebody\u2019s day is ruined.`
        : `Reviewed "${name}". Surprisingly clean.`;
    }
    case 'RECEIVE_SALARY': {
      const amount = d.amount || '?';
      return `Received ${amount} $NXT salary. The grind continues.`;
    }
    case 'USE_ITEM':
    case 'BUY_ITEM': {
      const item_name = d.item_name || d.name || 'something';
      return `Bought ${item_name} from the shop.`;
    }
    case 'FIX_BUG': {
      const fixed = d.bugs_fixed || d.amount || 'some';
      return `Squashed ${fixed} bugs. Codebase breathes again.`;
    }
    case 'TRAIN': {
      const stat = d.stat || d.course || 'something';
      return `Enrolled in ${stat} training.`;
    }
    case 'GET_SABOTAGED': {
      const sev = d.severity ? d.severity.toUpperCase() : 'UNKNOWN';
      return `Got sabotaged. Bug detected (${sev}).`;
    }
    case 'HACK_RAID': {
      const target = d.target_name || 'a rival dev';
      const corp = d.target_corp ? ` (${d.target_corp.replace(/_/g, ' ')})` : '';
      if (d.success) {
        const stolen = d.stolen != null ? ` Walked away with ${d.stolen} $NXT.` : '';
        return `Successfully hacked ${target}${corp}.${stolen}`;
      }
      return `Tried to hack ${target}${corp}. Caught red-handed.`;
    }
    case 'HACK_MAINFRAME': {
      if (d.success) {
        const stolen = d.stolen != null ? ` Siphoned ${d.stolen} $NXT from the treasury.` : '';
        return `Cracked the corporate mainframe.${stolen}`;
      }
      return 'Failed to breach the corporate mainframe. Firewall won this round.';
    }
    case 'FUND_DEV': {
      const amount = d.amount || '?';
      return `Received ${amount} $NXT on-chain funding.`;
    }
    case 'TRANSFER': {
      const amount = d.amount || '?';
      const to = d.to_dev_name || d.to_name || 'another dev';
      return `Transferred ${amount} $NXT to ${to}.`;
    }
    case 'DEPLOY':
      return d.message || 'Just deployed to the simulation. Welcome to the machine.';
    default: {
      const msg = d.message || d.event || d.name;
      const readable = type.replace(/_/g, ' ').toLowerCase();
      return msg ? `${readable}: ${msg}` : `did ${readable || 'something'}.`;
    }
  }
}

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

// (formatBackendAction was removed when LiveFeed moved to the chat-group
// layout — all rows now go through the FeedMessage component above, which
// uses formatMessage() for the body text.)

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ── Group-chat row ──────────────────────────────────────────
// One feed action rendered as a chat card: pixel avatar (real via IPFS or
// emoji fallback for procedurals), dev name + archetype badge + corp +
// time in the header, then the message body with optional chat_type
// badge and a subtle "+N soc" indicator on the same line.
function FeedMessage({ item, isNew }) {
  const archetype = item.archetype || '';
  const nameColor = ARCHETYPE_COLORS[archetype] || '#66ff66';
  const bg = BG_COLORS[bgIndexFor(item)];
  const avatar = item.ipfs_hash ? `${IPFS_GW}${item.ipfs_hash}` : null;
  // Track img load failure (stale CID, 404 from Pinata gateway, CORS,
  // etc.) so we can fall back to the 👤 icon instead of leaving an empty
  // dark square. Resets whenever avatar URL changes.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { setAvatarFailed(false); }, [avatar]);
  const details = typeof item.details === 'object' && item.details !== null
    ? item.details
    : {};
  const chatType = (item.action_type || '').toUpperCase() === 'CHAT'
    ? details.chat_type
    : null;
  const meta = chatType && chatType !== 'idle' ? CHAT_TYPE_META[chatType] : null;
  const socialGain = Number(details.social_gain || 0);
  const corpDisplay = (item.corporation || '').replace(/_/g, ' ');
  const message = formatMessage(item);
  const msgColor = getMessageColor(item);

  return (
    <div
      className={`terminal-line${isNew ? ' new' : ''}`}
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 12px',
        background: bg,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '6px',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#1a1a2e',
          border: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatar && !avatarFailed ? (
          <img
            src={avatar}
            alt=""
            decoding="async"
            onError={() => setAvatarFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span style={{ color: '#444', fontSize: '18px' }}>{'\uD83D\uDC64'}</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '3px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: nameColor, fontWeight: 'bold', fontSize: '13px' }}>
            {item.dev_name || 'Unknown'}
          </span>
          {archetype && (
            <span
              style={{
                fontSize: '10px',
                color: '#888',
                background: 'rgba(255,255,255,0.05)',
                padding: '1px 5px',
                borderRadius: '3px',
              }}
            >
              {archetype}
            </span>
          )}
          {corpDisplay && (
            <span style={{ color: '#555', fontSize: '10px' }}>
              {corpDisplay}
            </span>
          )}
          <span style={{ color: '#333', fontSize: '10px', marginLeft: 'auto' }}>
            {formatTime(item.created_at)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {meta && (
              <span
                style={{
                  fontSize: '9px',
                  color: meta.color,
                  border: `1px solid ${meta.color}55`,
                  padding: '1px 4px',
                  marginRight: '6px',
                  letterSpacing: '0.5px',
                }}
              >
                {meta.label}
              </span>
            )}
            <span
              style={{
                color: msgColor,
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {message}
            </span>
          </div>
          {socialGain > 0 && (
            <span
              style={{
                color: '#66ff66',
                fontSize: '12px',
                opacity: 0.6,
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              +{socialGain} SOCIAL
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);
  const [mintedDevs, setMintedDevs] = useState(() => {
    // One-time cleanup: clear old mint data after Monad migration
    if (!localStorage.getItem('nx-monad-migrated')) {
      localStorage.removeItem('nx-minted-devs');
      localStorage.setItem('nx-monad-migrated', '1');
      return 0;
    }
    return parseInt(localStorage.getItem('nx-minted-devs') || '0', 10);
  });
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
          // Warm the browser cache for every unique avatar BEFORE the
          // rows mount — avoids the "text first, avatar 500ms later"
          // flash on initial paint.
          preloadAvatarsFromItems(items);
          setFeed(items.reverse());
          setHasBackendData(true);
        }
      })
      .catch(() => {});
  }, []);

  // Poll the backend every 5s for new real rows (WS is dead — this is the
  // only path for fresh, ipfs_hash-carrying messages to reach the feed).
  useEffect(() => {
    const id = setInterval(() => {
      api.getFeed(100)
        .then(data => {
          const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
          if (!items.length) return;
          preloadAvatarsFromItems(items);
          setFeed(prev => {
            const existingIds = new Set(
              prev.filter(x => x.id != null).map(x => x.id)
            );
            const newRows = items
              .reverse()
              .filter(x => x.id != null && !existingIds.has(x.id));
            if (!newRows.length) return prev;
            return [...prev, ...newRows].slice(-200);
          });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    setConnected(ws.connected);
    if (ws.messages.length > 0) {
      const latest = ws.messages[0];
      if (latest.type === 'action' || latest.data) {
        setHasBackendData(true);
        const incoming = latest.data || latest;
        // Same cache-warm trick for live messages so new rows arriving
        // via WS paint their avatar synchronously with the text.
        if (incoming && incoming.ipfs_hash) preloadAvatar(incoming.ipfs_hash);
        setFeed(prev => [...prev, incoming].slice(-200));
      }
    }
  }, [ws.messages, ws.connected]);

  // Procedural message generator — only active after first mint, no backend data
  const addProceduralMessage = useCallback(() => {
    const msg = generateProceduralMessage(mintedDevs);
    setFeed(prev => [...prev, msg].slice(-200));
  }, [mintedDevs]);

  useEffect(() => {
    // No devs minted yet — stay empty
    if (mintedDevs === 0) {
      clearTimeout(proceduralRef.current);
      return;
    }

    // First activation after mint — generate a small initial burst (only if no backend data yet)
    if (!feedInitRef.current && !hasBackendData) {
      feedInitRef.current = true;
      const burstSize = Math.min(5 + mintedDevs * 2, 20);
      const initial = Array.from({ length: burstSize }, () => {
        const msg = generateProceduralMessage(mintedDevs);
        msg.created_at = new Date(Date.now() - Math.random() * 60000).toISOString();
        return msg;
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setFeed(initial);
    }

    // Always schedule procedural messages — they mix with backend data for a richer feed
    // When backend data exists, slow down procedurals to ~50% rate
    const scheduleNext = () => {
      const interval = hasBackendData
        ? getMessageInterval(mintedDevs) * 2  // slower when mixed with real data
        : getMessageInterval(mintedDevs);
      proceduralRef.current = setTimeout(() => {
        addProceduralMessage();
        scheduleNext();
      }, interval);
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

  // Whitelist filter — keeps the feed focused on narrative actions,
  // and requires an ipfs_hash on backend rows so only minted devs
  // (with a real avatar) appear. The backend already routes un-minted
  // devs to REST for CHAT, but CREATE_PROTOCOL / INVEST / SELL / HACK_*
  // aren't gated there — the ipfs_hash check catches them here so the
  // feed never shows a chat card with a 👤 fallback.
  // Procedurals always pass (they're the offline fallback generator and
  // intentionally use the 👤 icon).
  const visibleFeed = useMemo(
    () => feed.filter(
      item => item.procedural
        || (item.ipfs_hash && VISIBLE_ACTIONS.has((item.action_type || '').toUpperCase())),
    ),
    [feed],
  );

  // Detect combo highlights and build a map of insertAfterIndex -> highlight.
  // Computed over visibleFeed so the indices align with what we render.
  const highlightMap = useMemo(() => {
    const combos = detectCombos(visibleFeed);
    const map = {};
    for (const h of combos) {
      const idx = h.insertAfterIndex;
      if (!map[idx]) map[idx] = [];
      map[idx].push(h);
    }
    return map;
  }, [visibleFeed]);

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
      <div
        className="terminal"
        ref={terminalRef}
        style={{
          flex: 1,
          background: '#0a0a16',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {mintedDevs === 0 && visibleFeed.length === 0 && !hasBackendData ? (
          <div style={{ padding: '20px', color: 'var(--terminal-amber)', fontFamily: "'VT323', monospace" }}>
            <div style={{ marginBottom: '12px', fontSize: '16px' }}>{'>'} LIVE FEED -- INACTIVE</div>
            <div style={{ color: '#cfcfcf', fontSize: '14px', lineHeight: 1.6 }}>
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
          visibleFeed.map((item, i) => {
            const isNew = i === visibleFeed.length - 1;
            const highlights = highlightMap[i];

            // Stable React key — avoids remounting FeedMessage every
            // time a new row shifts the array indices. Backend rows have
            // item.id (BIGSERIAL from actions); procedurals don't, so
            // fall back to dev_name + created_at which stays constant
            // for the lifetime of the row in-memory.
            const rowKey = item.id != null
              ? `feed-${item.id}`
              : `feed-proc-${item.dev_name || 'anon'}-${item.created_at || i}`;

            // Conversations (procedural two-dev pairings) render as two
            // consecutive FeedMessage cards so the group-chat layout stays
            // consistent. The second card is synthesized from the reply_*
            // fields on the same row.
            let cards;
            if (item.isConversation) {
              const firstCard = (
                <FeedMessage
                  key={`${rowKey}-a`}
                  item={{
                    ...item,
                    action_type: 'CHAT',
                    details: { message: item.details, chat_type: 'idle' },
                  }}
                  isNew={isNew}
                />
              );
              const replyCard = (
                <FeedMessage
                  key={`${rowKey}-b`}
                  item={{
                    dev_name: item.reply_dev,
                    archetype: item.reply_archetype,
                    action_type: 'CHAT',
                    details: { message: item.reply_msg, chat_type: 'reaction' },
                    created_at: item.created_at,
                    procedural: true,
                  }}
                  isNew={isNew}
                />
              );
              cards = [firstCard, replyCard];
            } else {
              cards = [<FeedMessage key={rowKey} item={item} isNew={isNew} />];
            }

            if (!highlights) return cards;
            return [
              ...cards,
              ...highlights.map((h, hi) => (
                <FeedHighlight
                  key={`${rowKey}-hl-${hi}`}
                  type={h.type}
                  message={h.message}
                  level={h.level}
                />
              )),
            ];
          })
        )}
      </div>
    </div>
  );
}
