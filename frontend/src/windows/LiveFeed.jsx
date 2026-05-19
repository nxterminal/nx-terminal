import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';
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

// Tag color per action_type. Mirrors the palette already used in
// MyDevs.ACTION_COLORS so the same activity reads the same colour
// wherever it surfaces in the OS. Anything unmapped falls back to a
// muted grey so a new backend action_type can't blow up the render.
const ACTION_TAG_COLORS = {
  CHAT:            'var(--terminal-amber, #ffaa00)',
  CREATE_PROTOCOL: 'var(--terminal-green, #33ff33)',
  CREATE_AI:       'var(--terminal-cyan, #00ffff)',
  INVEST:          'var(--terminal-green, #33ff33)',
  SELL:            'var(--terminal-green, #33ff33)',
  CODE_REVIEW:     'var(--terminal-green, #33ff33)',
  MOVE:            'var(--terminal-cyan, #00ffff)',
  REST:            'var(--text-muted, #888)',
  RECEIVE_SALARY:  'var(--gold, #ffd700)',
  USE_ITEM:        'var(--terminal-cyan, #00ffff)',
  BUY_ITEM:        'var(--terminal-cyan, #00ffff)',
  FIX_BUG:         'var(--terminal-green, #33ff33)',
  TRAIN:           'var(--terminal-cyan, #00ffff)',
  GET_SABOTAGED:   'var(--terminal-red, #ff4444)',
  HACK_RAID:       'var(--terminal-red, #ff4444)',
  HACK_MAINFRAME:  'var(--terminal-red, #ff4444)',
  DEPLOY:          'var(--terminal-green, #33ff33)',
  FUND_DEV:        'var(--gold, #ffd700)',
  TRANSFER:        'var(--terminal-cyan, #00ffff)',
};
const DEFAULT_TAG_COLOR = 'var(--text-muted, #888)';

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

// Inline avatar fallback used when ipfs_hash is missing OR the IPFS
// gateway returns an error on the live <img>. We render the row no
// matter what — a degraded gateway never silently empties the feed.
// Win98 grey square, archetype initial centred in black.
function AvatarFallback({ archetype, size = 36 }) {
  const initial = (archetype || '?').charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#c0c0c0',
        border: '1px solid #808080',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        fontFamily: "'VT323', monospace",
        fontWeight: 'bold',
        fontSize: Math.max(14, Math.floor(size * 0.55)),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

// Color of the message body. CHAT messages inherit from their chat_type
// (hot_take/drama/meme/debate/reaction) so spicy posts pop visually.
// Everything else is a neutral light grey — the [TAG] colour already
// carries the action's semantic signal.
function getMessageColor(item) {
  if ((item.action_type || '').toUpperCase() !== 'CHAT') return '#aaa';
  const chatType = item.details && item.details.chat_type;
  const meta = chatType && CHAT_TYPE_META[chatType];
  return meta ? meta.msgColor : '#ccc';
}

// Single-line message per action_type, formatted as if the dev were posting
// in a group chat.
function formatMessage(item) {
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
        ? `Reviewed "${name}" and found a bug. Somebody’s day is ruined.`
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

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ── Group-chat row ──────────────────────────────────────────
// One feed action rendered as a chat bubble, WhatsApp-style:
//   - isOwnDev=true  → right-aligned, greenish tint, +N SOCIAL badge visible
//   - isOwnDev=false → left-aligned, neutral tint, no SOCIAL badge
// The row mounts the instant the action arrives — the avatar resolves
// asynchronously and swaps to AvatarFallback on error. The feed never
// drops a row because of a slow or broken IPFS gateway.
function FeedMessage({ item, isNew, isOwnDev }) {
  const archetype = item.archetype || '';
  const nameColor = ARCHETYPE_COLORS[archetype] || '#66ff66';
  const details = typeof item.details === 'object' && item.details !== null
    ? item.details
    : {};
  const actionType = (item.action_type || 'UNKNOWN').toUpperCase();
  const chatType = actionType === 'CHAT' ? details.chat_type : null;
  const meta = chatType && chatType !== 'idle' ? CHAT_TYPE_META[chatType] : null;
  const socialGain = Number(details.social_gain || 0);
  const corpDisplay = (item.corporation || '').replace(/_/g, ' ');
  const message = formatMessage(item);
  const msgColor = getMessageColor(item);
  const tagColor = ACTION_TAG_COLORS[actionType] || DEFAULT_TAG_COLOR;

  // Per-row avatar error flag. We render <img> optimistically; if the
  // IPFS gateway errors out, we flip to the inline placeholder instead
  // of dropping the row.
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = !!item.ipfs_hash && !imgFailed;

  // Bubble palette — own devs get a subtle green tint + brighter border so
  // the player's messages pop on the right, everything else is a neutral
  // dark bubble on the left. Glow on new own-dev messages is a bit more
  // intense than the default .new flash to celebrate "my dev just spoke".
  const bubbleBg = isOwnDev
    ? 'rgba(70, 200, 110, 0.08)'
    : 'rgba(255, 255, 255, 0.025)';
  const bubbleBorder = isOwnDev
    ? '1px solid rgba(102, 255, 120, 0.35)'
    : '1px solid rgba(255, 255, 255, 0.08)';
  const ownGlow = isOwnDev && isNew
    ? '0 0 12px rgba(102, 255, 120, 0.45)'
    : 'none';

  return (
    <div
      className={`terminal-line${isNew ? ' new' : ''}`}
      style={{
        display: 'flex',
        justifyContent: isOwnDev ? 'flex-end' : 'flex-start',
        padding: '6px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isOwnDev ? 'row-reverse' : 'row',
          gap: '8px',
          maxWidth: '82%',
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
          }}
        >
          {showImg ? (
            <img
              src={`${IPFS_GW}${item.ipfs_hash}`}
              alt=""
              decoding="async"
              loading="lazy"
              onError={() => setImgFailed(true)}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                objectFit: 'cover',
                display: 'block',
                // PFP crop — same values as MyDevs.GifImage and
                // DevProfile header GIF. The 36×36 parent is already
                // overflow: hidden so the scaled pixels clip cleanly.
                transform: 'scale(2.2)',
                transformOrigin: 'center 32%',
              }}
            />
          ) : (
            <AvatarFallback archetype={archetype} size={36} />
          )}
        </div>

        <div
          style={{
            background: bubbleBg,
            border: bubbleBorder,
            borderRadius: '10px',
            padding: '6px 10px',
            minWidth: 0,
            boxShadow: ownGlow,
            transition: 'box-shadow 600ms ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '3px',
              flexWrap: 'wrap',
              justifyContent: isOwnDev ? 'flex-end' : 'flex-start',
            }}
          >
            <span style={{ color: nameColor, fontWeight: 'bold', fontSize: 'var(--text-base)' }}>
              {item.dev_name || 'Unknown'}
            </span>
            {archetype && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
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
              <span style={{ color: '#555', fontSize: 'var(--text-xs)' }}>
                {corpDisplay}
              </span>
            )}
            <span style={{ color: '#333', fontSize: 'var(--text-xs)' }}>
              {formatTime(item.created_at)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              flexDirection: isOwnDev ? 'row-reverse' : 'row',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, textAlign: isOwnDev ? 'right' : 'left' }}>
              <span
                style={{
                  color: tagColor,
                  fontFamily: "'VT323', monospace",
                  fontWeight: 'bold',
                  letterSpacing: '0.5px',
                  marginRight: '6px',
                  textTransform: 'uppercase',
                }}
              >
                [{actionType}]
              </span>
              {meta && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
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
            {/* +N SOCIAL badge is private: only shown on the player's own
                devs. Other players' social progress stays hidden from view
                even though the backend tracks it. */}
            {isOwnDev && socialGain > 0 && (
              <span
                style={{
                  color: '#66ff66',
                  fontSize: 'var(--text-sm)',
                  opacity: 0.7,
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
    </div>
  );
}

export default function LiveFeed() {
  const [feed, setFeed] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
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
  // Connected wallet drives right/left alignment — rows whose owner_address
  // matches `address` are rendered as "my dev" (right, green tint, +SOCIAL
  // visible). Everyone else lands on the left. With no wallet, every row
  // goes left (spectator mode).
  const { address } = useWallet();
  const myAddr = (address || '').toLowerCase();

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

  // Poll the backend every 5s for new rows. Rows mount the moment they
  // arrive — no avatar gate, no action-type filter.
  useEffect(() => {
    const id = setInterval(() => {
      api.getFeed(100)
        .then(data => {
          const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
          if (!items.length) return;
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

  // Auto-scroll
  useEffect(() => {
    if (!scrollLock && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [feed, scrollLock]);

  // Every action from the backend renders. The CHAT-only filter and
  // the avatar preload gate are gone — broken images degrade gracefully
  // per-row via AvatarFallback inside FeedMessage.
  const visibleFeed = feed;

  // Detect combo highlights and build a map of insertAfterIndex -> highlight.
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
          background: hasBackendData
            ? 'var(--terminal-green)'
            : mintedDevs === 0 ? 'var(--border-dark)' : 'var(--terminal-amber)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 'var(--text-sm)' }}>
          {hasBackendData
            ? 'LIVE'
            : mintedDevs > 0
              ? `SIMULATION ACTIVE -- ${mintedDevs} dev${mintedDevs !== 1 ? 's' : ''} deployed`
              : 'AWAITING FIRST DEPLOYMENT'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="win-btn"
          onClick={() => setScrollLock(s => !s)}
          style={{ fontSize: 'var(--text-xs)', padding: '1px 6px' }}
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
            <div style={{ marginBottom: '12px', fontSize: 'var(--text-lg)' }}>{'>'} LIVE FEED -- INACTIVE</div>
            <div style={{ color: '#cfcfcf', fontSize: 'var(--text-base)', lineHeight: 1.6 }}>
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
            // time a new row shifts the array indices.
            const rowKey = `feed-${item.id}`;
            const isOwnDev = !!myAddr
              && !!item.owner_address
              && item.owner_address.toLowerCase() === myAddr;
            const card = (
              <FeedMessage
                key={rowKey}
                item={item}
                isNew={isNew}
                isOwnDev={isOwnDev}
              />
            );

            if (!highlights) return card;
            return [
              card,
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
