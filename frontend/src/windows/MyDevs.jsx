import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI } from '../services/contract';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': 'var(--red-on-grey, #aa0000)', 'LURKER': 'var(--common-on-grey, #333333)', 'DEGEN': 'var(--gold-on-grey, #7a5c00)',
  'GRINDER': 'var(--blue-on-grey, #0d47a1)', 'INFLUENCER': 'var(--pink-on-grey, #660066)', 'HACKTIVIST': 'var(--green-on-grey, #005500)',
  'FED': 'var(--amber-on-grey, #7a5500)', 'SCRIPT_KIDDIE': 'var(--cyan-on-grey, #005060)',
};

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

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

function DevCard({ dev, onClick, address }) {
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

export default function MyDevs({ openDevProfile }) {
  const { address, isConnected, connect, displayAddress } = useWallet();
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const { data: ownedTokens, isLoading: tokensLoading } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (!ownedTokens || ownedTokens.length === 0) {
      setDevs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    const tokenIds = ownedTokens.map(id => Number(id));

    Promise.all(
      tokenIds.map(id =>
        api.getDev(id).catch((err) => {
          console.warn(`[MyDevs] Failed to fetch dev #${id}:`, err.message);
          return {
            token_id: id,
            name: `Dev #${id}`,
            archetype: 'UNKNOWN',
            _fetchFailed: true,
          };
        })
      )
    )
      .then(results => setDevs(results))
      .catch(() => setFetchError('Failed to load developer data'))
      .finally(() => setLoading(false));
  }, [ownedTokens]);

  const isLoadingAny = tokensLoading || loading;

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
        <span>{'>'} MY DEVELOPERS ({devs.length})</span>
        <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
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

      <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
        {isLoadingAny ? (
          <div className="loading">Loading devs...</div>
        ) : (
          devs.map((dev) => (
            <DevCard
              key={dev.token_id}
              dev={dev}
              address={address}
              onClick={() => openDevProfile?.(dev.token_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
