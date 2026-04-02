import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, MEGAETH_CHAIN_ID, MEGAETH_RPC } from '../services/contract';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': 'var(--red-on-grey, #aa0000)', 'LURKER': 'var(--common-on-grey, #333333)', 'DEGEN': 'var(--gold-on-grey, #7a5c00)',
  'GRINDER': 'var(--blue-on-grey, #0d47a1)', 'INFLUENCER': 'var(--pink-on-grey, #660066)', 'HACKTIVIST': 'var(--green-on-grey, #005500)',
  'FED': 'var(--amber-on-grey, #7a5500)', 'SCRIPT_KIDDIE': 'var(--cyan-on-grey, #005060)',
};

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

const BOOT_LINES = [
  { text: 'NX TERMINAL — Developer Retrieval System v4.2', color: '#ffaa00', delay: 0 },
  { text: 'Establishing secure connection to MegaETH...', color: '#ccc', delay: 300 },
  { text: 'Chain ID: 4326 .......................... OK', color: '#888', delay: 600 },
  { text: 'Scanning contract for owned tokens...', color: '#ccc', delay: 900 },
  { text: 'Decrypting personnel files...', color: '#ccc', delay: 1300 },
  { text: 'Compiling developer profiles...', color: '#ccc', delay: 1700 },
  { text: 'Loading dev workstations...', color: '#ccc', delay: 2100 },
];

function LoadingLore() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    const progTimer = setInterval(() => {
      setProgress(p => p >= 100 ? 100 : p + 3);
    }, 120);
    return () => { timers.forEach(clearTimeout); clearInterval(progTimer); };
  }, []);

  const barLen = 20;
  const filled = Math.round((progress / 100) * barLen);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

  return (
    <div style={{
      padding: '16px 20px',
      fontFamily: "'VT323', monospace",
      fontSize: '13px',
      lineHeight: 1.6,
    }}>
      {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
        <div key={i} style={{ color: line.color }}>&gt; {line.text}</div>
      ))}
      <div style={{ marginTop: '8px', color: '#ffaa00' }}>
        [{bar}] {Math.min(progress, 99)}%
      </div>
    </div>
  );
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function StatBar({ label, value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / max) * 100));
  const color = pct > 66 ? 'var(--green-on-grey, #005500)' : pct > 33 ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
      <span style={{ width: '24px', color: 'var(--text-muted, #999)', textTransform: 'uppercase', fontWeight: 'bold' }}>{label}</span>
      <div style={{
        flex: 1, height: '6px', background: 'var(--terminal-bg, #111)',
        border: '1px solid var(--border-dark, #444)',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ width: '18px', textAlign: 'right', color, fontWeight: 'bold', fontSize: '9px' }}>{value || 0}</span>
    </div>
  );
}

function GifImage({ src, alt, arcColor, tokenId }) {
  const [status, setStatus] = useState(src ? 'loading' : 'none');

  return (
    <div style={{
      width: '80px', height: '80px', flexShrink: 0,
      background: 'var(--terminal-bg, #111)', border: '1px solid var(--border-dark, #333)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {src && status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated',
            opacity: status === 'loaded' ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
      {/* Skeleton / placeholder */}
      {(status === 'loading' || status === 'error' || status === 'none') && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted, #555)', fontSize: '10px',
          fontFamily: "'VT323', monospace",
          background: status === 'loading' ? undefined : 'var(--terminal-bg, #111)',
        }}>
          {status === 'loading' ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #666)', animation: 'pulse 1.5s infinite' }}>...</div>
          ) : (
            <>
              <div style={{ fontSize: '24px', color: arcColor }}>@</div>
              <div>#{tokenId}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuickPrompt({ devId, devName, address }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | 'error'

  const handleSend = (e) => {
    e.stopPropagation();
    if (!text.trim() || !address) return;
    setStatus('sending');
    api.postPrompt(devId, address, text.trim())
      .then(() => {
        setStatus('sent');
        setText('');
        setTimeout(() => setStatus(null), 3000);
      })
      .catch((err) => {
        if (err.message && err.message.includes('429')) {
          setStatus('busy');
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus('error');
        }
      });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex', gap: '3px', alignItems: 'center',
        marginTop: '3px', position: 'relative',
      }}
    >
      {status === 'sent' ? (
        <span style={{
          fontSize: '10px', color: 'var(--terminal-green, #33ff33)',
          fontFamily: "'VT323', monospace",
        }}>
          Order sent to {devName}!
        </span>
      ) : status === 'busy' ? (
        <span style={{
          fontSize: '10px', color: 'var(--terminal-amber, #ffaa00)',
          fontFamily: "'VT323', monospace",
        }}>
          {devName} is still processing the last order. Wait...
        </span>
      ) : (
        <>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
            placeholder={`Give orders to ${devName}...`}
            maxLength={500}
            disabled={status === 'sending'}
            style={{
              flex: 1, background: 'var(--terminal-bg, #111)', color: 'var(--terminal-green, #33ff33)',
              border: '1px solid var(--border-dark, #444)', padding: '2px 5px',
              fontFamily: "'VT323', monospace", fontSize: '11px', outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            className="win-btn"
            onClick={handleSend}
            disabled={!text.trim() || status === 'sending'}
            style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0, fontWeight: 'bold' }}
          >
            {status === 'sending' ? '..' : '>'}
          </button>
          {status === 'error' && (
            <span style={{ fontSize: '9px', color: 'var(--terminal-red, #ff4444)' }}>err</span>
          )}
        </>
      )}
    </div>
  );
}

function DevCard({ dev, onClick, address, onRetry }) {
  const arcColor = ARCHETYPE_COLORS[dev.archetype] || '#ccc';
  const gifUrl = dev.ipfs_hash ? `${IPFS_GW}${dev.ipfs_hash}` : null;
  const energyPct = dev.max_energy ? Math.round((dev.energy / dev.max_energy) * 100) : (dev.energy || 0);
  const energyColor = energyPct > 60 ? 'var(--green-on-grey, #005500)' : energyPct > 30 ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)';
  const loc = dev.location ? dev.location.replace(/_/g, ' ') : null;

  return (
    <div
      className="win-raised"
      onClick={onClick}
      style={{
        display: 'flex', gap: '10px', padding: '8px',
        cursor: 'pointer', marginBottom: '4px',
        border: '1px solid var(--border-dark)',
      }}
    >
      <GifImage src={gifUrl} alt={dev.name} arcColor={arcColor} tokenId={dev.token_id} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {dev._fetchFailed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '2px 6px', marginBottom: '2px',
            background: 'var(--terminal-bg, #111)', border: '1px solid var(--terminal-amber, #ffaa00)',
            fontSize: '10px', fontFamily: "'VT323', monospace", color: 'var(--terminal-amber, #ffaa00)',
          }}>
            [!] Profile loading from chain...
            <button
              className="win-btn"
              onClick={(e) => { e.stopPropagation(); onRetry?.(dev.token_id); }}
              style={{ fontSize: '9px', padding: '0 4px', marginLeft: 'auto' }}
            >
              Retry
            </button>
          </div>
        )}
        {/* Row 1: Name + Archetype */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-primary)' }}>{dev.name}</span>
          <span style={{ color: arcColor, fontSize: '10px', fontWeight: 'bold' }}>
            [{dev.archetype}]
          </span>
          {dev.rarity_tier && dev.rarity_tier !== 'common' && (
            <span style={{ fontSize: '9px', color: 'var(--gold-on-grey, #7a5c00)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {dev.rarity_tier}
            </span>
          )}
        </div>

        {/* Row 2: Corporation + Species + Location */}
        <div style={{ fontSize: '10px', color: 'var(--text-secondary, #666)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {dev.corporation && <span>{dev.corporation.replace(/_/g, ' ')}</span>}
          {dev.species && <span>| {dev.species}</span>}
          {loc && <span>| {loc}</span>}
          <span>| #{dev.token_id}</span>
        </div>

        {/* Row 3: Stats bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px', marginTop: '2px' }}>
          <StatBar label="COD" value={dev.stat_coding} />
          <StatBar label="HAK" value={dev.stat_hacking} />
          <StatBar label="TRD" value={dev.stat_trading} />
          <StatBar label="SOC" value={dev.stat_social} />
          <StatBar label="END" value={dev.stat_endurance} />
          <StatBar label="LCK" value={dev.stat_luck} />
        </div>

        {/* Row 4: Dynamic status + counters */}
        <div style={{
          display: 'flex', gap: '6px', fontSize: '10px', marginTop: '2px',
          flexWrap: 'wrap', alignItems: 'center',
          color: 'var(--text-secondary, #666)',
        }}>
          <span style={{ color: energyColor, fontWeight: 'bold' }}>
            E:{dev.energy ?? 0}/{dev.max_energy ?? 10}
          </span>
          <span style={{ color: 'var(--gold-on-grey, #7a5c00)', fontWeight: 'bold' }}>
            {formatNumber(dev.balance_nxt)} $NXT
          </span>
          <span>{dev.mood || '-'}</span>
          <span style={{
            color: dev.status === 'active' ? 'var(--green-on-grey, #005500)' : dev.status === 'resting' ? 'var(--amber-on-grey, #7a5500)' : 'var(--red-on-grey, #aa0000)',
            textTransform: 'uppercase', fontWeight: 'bold',
          }}>
            {dev.status || 'active'}
          </span>
        </div>

        {/* Row 5: Counters */}
        <div style={{
          display: 'flex', gap: '8px', fontSize: '9px', marginTop: '1px',
          color: 'var(--text-muted, #888)',
        }}>
          {dev.coffee_count > 0 && <span>coffee:{dev.coffee_count}</span>}
          {dev.lines_of_code > 0 && <span>LoC:{formatNumber(dev.lines_of_code)}</span>}
          {dev.bugs_shipped > 0 && <span>bugs:{dev.bugs_shipped}</span>}
          {dev.hours_since_sleep > 0 && <span>nosleep:{dev.hours_since_sleep}h</span>}
          {dev.last_action_type && (
            <span style={{ color: 'var(--cyan-on-grey, #006677)' }}>
              [{dev.last_action_type.replace(/_/g, ' ')}]
            </span>
          )}
        </div>

        {/* Row 6: Quick prompt input */}
        {address && (
          <QuickPrompt devId={dev.token_id} devName={dev.name} address={address} />
        )}
      </div>
    </div>
  );
}

// Dev action notification types shown in Activity tab
const DEV_ACTION_NOTIF_TYPES = ['protocol_created', 'ai_created', 'invest', 'sell', 'code_review'];

const ACTION_ICONS = {
  protocol_created: '[P]',
  ai_created: '[AI]',
  invest: '[$$]',
  sell: '[$$]',
  code_review: '[CR]',
  prompt_response: '[>]',
};

const ACTION_COLORS = {
  protocol_created: 'var(--terminal-green, #33ff33)',
  ai_created: 'var(--terminal-cyan, #00ffff)',
  invest: 'var(--gold, #ffd700)',
  sell: 'var(--gold, #ffd700)',
  code_review: 'var(--terminal-amber, #ffaa00)',
  prompt_response: 'var(--terminal-green, #33ff33)',
};

function formatActivityTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ActivityTab({ walletAddress, devs }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDev, setFilterDev] = useState('all');

  useEffect(() => {
    if (!walletAddress) { setLoading(false); return; }

    const fetchActivities = () => {
      api.getNotifications(walletAddress)
        .then(notifs => {
          if (!Array.isArray(notifs)) { setActivities([]); return; }
          const devActions = notifs.filter(n => DEV_ACTION_NOTIF_TYPES.includes(n.type));
          setActivities(devActions);
        })
        .catch(() => setActivities([]))
        .finally(() => setLoading(false));
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (loading) return <div className="loading">Loading activity...</div>;

  const filtered = filterDev === 'all'
    ? activities
    : activities.filter(a => a.dev_id === Number(filterDev));

  // Build dev name map
  const devNameMap = {};
  (devs || []).forEach(d => { devNameMap[d.token_id] = d.name; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '11px',
      }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-muted, #888)' }}>Filter:</span>
        <select
          value={filterDev}
          onChange={(e) => setFilterDev(e.target.value)}
          style={{
            fontSize: '11px', padding: '2px 4px',
            background: 'var(--bg-primary, #fff)',
            border: '1px solid var(--border-dark, #808080)',
          }}
        >
          <option value="all">All Devs ({activities.length})</option>
          {(devs || []).map(d => {
            const count = activities.filter(a => a.dev_id === d.token_id).length;
            return (
              <option key={d.token_id} value={d.token_id}>
                {d.name || `Dev #${d.token_id}`} ({count})
              </option>
            );
          })}
        </select>
        <span style={{ color: 'var(--text-muted, #888)', marginLeft: 'auto' }}>
          {filtered.length} action{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Activity list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center',
            fontFamily: "'VT323', monospace", fontSize: '14px',
            color: 'var(--terminal-amber)',
          }}>
            {'>'} No dev actions recorded yet.
          </div>
        ) : (
          <div className="terminal" style={{ padding: '4px 8px' }}>
            {filtered.map((a, i) => {
              const icon = ACTION_ICONS[a.type] || '[?]';
              const color = ACTION_COLORS[a.type] || '#888';
              const devName = devNameMap[a.dev_id] || (a.dev_id ? `Dev #${a.dev_id}` : '');
              return (
                <div key={a.id || i} style={{
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  lineHeight: 1.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color, fontWeight: 'bold', fontFamily: "'VT323', monospace", fontSize: '15px', flexShrink: 0 }}>
                      {icon}
                    </span>
                    <span style={{ fontWeight: 'bold', color, fontSize: '13px', fontFamily: "'VT323', monospace" }}>
                      {a.title}
                    </span>
                    <span style={{ marginLeft: 'auto', color: '#999', fontSize: '12px', flexShrink: 0, fontFamily: "'VT323', monospace" }}>
                      {formatActivityTime(a.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', color: '#bbb',
                    marginTop: '2px', paddingLeft: '30px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: "'VT323', monospace",
                  }}>
                    {devName && (
                      <span style={{ color: 'var(--terminal-cyan, #00ffff)', fontWeight: 'bold' }}>
                        {devName}:{' '}
                      </span>
                    )}
                    {a.body ? a.body.slice(0, 200) : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyDevs({ openDevProfile }) {
  const { address, isConnected, connect, displayAddress } = useWallet();
  const [tab, setTab] = useState('devs');
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [activityCount, setActivityCount] = useState(0);
  const initialLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: ownedTokens, isLoading: tokensLoading } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: 60_000 },
  });

  // ── Direct RPC fallback for tokensOfOwner if wagmi fails ──
  const [rpcTokens, setRpcTokens] = useState(null);
  useEffect(() => {
    if (!address || ownedTokens != null) return;
    if (tokensLoading) return;
    let cancelled = false;

    const tryRpc = async () => {
      // tokensOfOwner(address) selector = 0x8462151c
      const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
      const data = '0x8462151c' + paddedAddr;

      // Try wallet provider first, then direct RPC
      const providers = [];
      if (window.ethereum) {
        providers.push(async () => {
          return await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'],
          });
        });
      }
      providers.push(async () => {
        const res = await fetch(MEGAETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_call', params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'] }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        return json.result;
      });

      for (const call of providers) {
        if (cancelled) return;
        try {
          const result = await call();
          if (!result || result === '0x') continue;
          // Decode ABI-encoded uint256[] — offset(32) + length(32) + items(32 each)
          const hex = result.slice(2); // strip 0x
          if (hex.length < 128) continue; // at least offset + length
          const length = parseInt(hex.slice(64, 128), 16);
          const ids = [];
          for (let i = 0; i < length; i++) {
            ids.push(parseInt(hex.slice(128 + i * 64, 128 + (i + 1) * 64), 16));
          }
          if (!cancelled) setRpcTokens(ids.map(BigInt));
          return;
        } catch { /* try next */ }
      }
    };

    const timer = setTimeout(tryRpc, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, ownedTokens, tokensLoading]);

  // Memoize by value (stringified IDs) to prevent re-render loops
  const tokenKey = useMemo(() => {
    const tokens = ownedTokens ?? rpcTokens;
    return tokens ? tokens.map(String).join(',') : '';
  }, [ownedTokens, rpcTokens]);

  const tokenIds = useMemo(() => {
    if (!tokenKey) return [];
    return tokenKey.split(',').map(Number);
  }, [tokenKey]);

  useEffect(() => {
    if (tokenIds.length === 0) {
      setDevs([]);
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load or manual refresh
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setFetchError(null);

    // Fetch with retry: if first attempt fails, wait 2s and try once more
    // Pass owner address so backend can skip ownerOf RPC check
    const fetchWithRetry = (id) =>
      api.getDev(id, address).catch(() =>
        new Promise(resolve => setTimeout(resolve, 2000))
          .then(() => api.getDev(id, address))
          .catch((err) => {
            console.warn(`[MyDevs] Failed to fetch dev #${id}:`, err.message);
            return {
              token_id: id,
              name: `Dev #${id}`,
              archetype: 'UNKNOWN',
              _fetchFailed: true,
            };
          })
      );

    Promise.all(tokenIds.map(fetchWithRetry))
      .then(results => {
        setDevs(results);
        initialLoadDone.current = true;
      })
      .catch(() => setFetchError('Failed to load developer data'))
      .finally(() => setLoading(false));
  }, [tokenKey, refreshKey, address]);

  // Fetch activity count for badge
  useEffect(() => {
    if (!address) return;
    api.getNotifications(address)
      .then(notifs => {
        if (!Array.isArray(notifs)) return;
        const unread = notifs.filter(n => DEV_ACTION_NOTIF_TYPES.includes(n.type) && !n.read).length;
        setActivityCount(unread);
      })
      .catch(() => {});
  }, [address]);

  // Only show loading if we haven't loaded yet or manual refresh triggered
  const isLoadingAny = loading || (tokensLoading && !initialLoadDone.current);

  const headerStyle = {
    padding: '6px 8px',
    background: 'var(--terminal-bg)',
    fontFamily: "'VT323', monospace",
    fontSize: '14px',
    borderBottom: '1px solid var(--border-dark)',
    display: 'flex', justifyContent: 'space-between',
  };

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ ...headerStyle, color: 'var(--terminal-amber)' }}>
          {'>'} MY DEVELOPERS
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace", color: 'var(--text-muted, #555)' }}>[@]</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            Connect wallet to see your devs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
            Your developers will appear here once your wallet is connected.
          </div>
          <button className="win-btn" onClick={connect} style={{ padding: '4px 20px', fontWeight: 'bold' }}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!isLoadingAny && devs.length === 0 && !fetchError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ ...headerStyle, color: 'var(--terminal-green)' }}>
          <span>{'>'} MY DEVELOPERS</span>
          <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace", color: 'var(--text-muted, #555)' }}>[+]</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)' }}>
            No devs yet
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
            Open Mint/Hire Devs to get started!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...headerStyle, color: 'var(--terminal-green)' }}>
        <span>
          {'>'} MY DEVELOPERS ({devs.length})
          {' '}
          <button
            className="win-btn"
            onClick={() => { initialLoadDone.current = false; setLoading(true); setRefreshKey(k => k + 1); }}
            style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '6px', cursor: 'pointer' }}
          >
            &#x21bb; Refresh
          </button>
        </span>
        <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
      </div>

      {/* Tabs */}
      <div className="win-tabs">
        <button className={`win-tab${tab === 'devs' ? ' active' : ''}`} onClick={() => setTab('devs')}>
          Devs
        </button>
        <button className={`win-tab${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
          Activity{activityCount > 0 ? ` (${activityCount})` : ''}
        </button>
      </div>

      {fetchError && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-red)',
          color: 'var(--terminal-red)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
        }}>
          [X] {fetchError}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'devs' && (
          <div style={{ height: '100%', overflow: 'auto', padding: '4px' }}>
            {isLoadingAny ? (
              <LoadingLore />
            ) : (
              devs.map((dev) => (
                <DevCard
                  key={dev.token_id}
                  dev={dev}
                  address={address}
                  onClick={() => openDevProfile?.(dev.token_id)}
                  onRetry={(id) => {
                    api.getDev(id, address).then(fresh => {
                      if (fresh && !fresh._fetchFailed) {
                        setDevs(prev => prev.map(d => d.token_id === id ? fresh : d));
                      }
                    }).catch(() => {});
                  }}
                />
              ))
            )}
          </div>
        )}
        {tab === 'activity' && (
          <ActivityTab walletAddress={address} devs={devs} />
        )}
      </div>
    </div>
  );
}
