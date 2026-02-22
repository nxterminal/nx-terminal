import { useState, useEffect } from 'react';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444', 'LURKER': '#808080', 'DEGEN': '#ffd700',
  'GRINDER': '#4488ff', 'INFLUENCER': '#ff44ff', 'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00', 'SCRIPT_KIDDIE': '#00ffff',
};

const RARITY_COLORS = {
  common: '#c0c0c0', uncommon: '#33ff33', rare: '#4488ff',
  legendary: '#ffd700', mythic: '#ff44ff',
};

const PINATA_GW = 'https://gateway.pinata.cloud/ipfs/';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function StatBar({ label, value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / max) * 100));
  const color = pct > 66 ? '#33ff33' : pct > 33 ? '#ffaa00' : '#ff4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
      <span style={{ width: '60px', color: '#aaa', textTransform: 'capitalize' }}>{label}</span>
      <div style={{
        flex: 1, height: '8px', background: '#1a1a1a',
        border: '1px solid #444',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ width: '24px', textAlign: 'right', color, fontWeight: 'bold' }}>{value || 0}</span>
    </div>
  );
}

function TraitRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{value.replace(/_/g, ' ')}</span>
    </div>
  );
}

export default function DevProfile({ devId }) {
  const [dev, setDev] = useState(null);
  const [tab, setTab] = useState('history');
  const [tabData, setTabData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!devId) return;
    setLoading(true);
    api.getDev(devId)
      .then(d => setDev(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [devId]);

  useEffect(() => {
    if (!devId) return;
    setTabLoading(true);
    const fetchers = {
      history: () => api.getDevHistory(devId),
      protocols: () => api.getDevProtocols(devId),
      ais: () => api.getDevAIs(devId),
      investments: () => api.getDevInvestments(devId),
      messages: () => api.getDevMessages(devId),
    };
    (fetchers[tab] || fetchers.history)()
      .then(d => setTabData(Array.isArray(d) ? d : d[tab] || d.data || []))
      .catch(() => setTabData([]))
      .finally(() => setTabLoading(false));
  }, [devId, tab]);

  if (loading) return <div className="loading">Loading dev profile...</div>;
  if (!dev) return <div className="error-msg">Dev not found</div>;

  const arcColor = ARCHETYPE_COLORS[dev.archetype] || '#ccc';
  const rarityColor = RARITY_COLORS[dev.rarity_tier] || '#c0c0c0';
  const gifUrl = dev.ipfs_hash ? `${PINATA_GW}${dev.ipfs_hash}` : null;
  const energyPct = dev.max_energy ? Math.round((dev.energy / dev.max_energy) * 100) : (dev.energy || 0);
  const energyColor = energyPct > 60 ? '#33ff33' : energyPct > 30 ? '#ffaa00' : '#ff4444';

  const hasStats = dev.stat_coding != null || dev.stat_hacking != null;
  const hasTraits = dev.alignment || dev.risk_level || dev.social_style || dev.coding_style || dev.work_ethic;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* ── Header with GIF ── */}
      <div style={{
        padding: '10px', borderBottom: '2px solid var(--border-dark)',
        display: 'flex', gap: '12px',
      }}>
        {/* GIF */}
        <div style={{
          width: '100px', height: '100px', flexShrink: 0,
          background: '#0a0a0a', border: '2px solid #333',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {gifUrl && !imgError ? (
            <img
              src={gifUrl}
              alt={dev.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', color: '#555', fontFamily: "'VT323', monospace",
            }}>
              <div style={{ fontSize: '36px', color: arcColor }}>@</div>
              <div style={{ fontSize: '11px' }}>#{dev.token_id || devId}</div>
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{dev.name}</span>
            <span style={{ color: arcColor, fontWeight: 'bold', fontSize: '11px' }}>
              [{dev.archetype}]
            </span>
            {dev.rarity_tier && (
              <span style={{ fontSize: '10px', color: rarityColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {dev.rarity_tier}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {dev.corporation && <span>{dev.corporation.replace(/_/g, ' ')}</span>}
            {dev.species && <span> | {dev.species}</span>}
            <span> | Token #{dev.token_id || devId}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', marginTop: '2px', flexWrap: 'wrap' }}>
            <span style={{ color: energyColor }}>
              Energy: {dev.energy ?? 0}/{dev.max_energy ?? 10}
            </span>
            <span style={{ color: 'var(--gold)' }}>
              {formatNumber(dev.balance_nxt)} $NXT
            </span>
            <span>Rep: {formatNumber(dev.reputation)}</span>
          </div>
        </div>
      </div>

      {/* ── Dynamic Status Bar ── */}
      <div style={{
        display: 'flex', gap: '12px', padding: '6px 10px',
        background: 'var(--terminal-bg)', fontSize: '11px',
        fontFamily: "'VT323', monospace",
        borderBottom: '1px solid var(--border-dark)',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--terminal-green)' }}>
          Mood: <span style={{ color: '#fff' }}>{dev.mood || '?'}</span>
        </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          Location: <span style={{ color: '#fff' }}>{dev.location ? dev.location.replace(/_/g, ' ') : '?'}</span>
        </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          Status: <span style={{
            color: dev.status === 'active' ? '#33ff33' : dev.status === 'resting' ? '#ffaa00' : '#ff4444',
            textTransform: 'uppercase',
          }}>{dev.status || 'active'}</span>
        </span>
      </div>

      {/* ── Stats + Traits panels ── */}
      {(hasStats || hasTraits) && (
        <div style={{ display: 'flex', gap: '4px', padding: '6px 6px 0' }}>
          {/* Stats */}
          {hasStats && (
            <div className="win-panel" style={{ flex: 1, padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--terminal-cyan)' }}>
                STATS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <StatBar label="Coding" value={dev.stat_coding} />
                <StatBar label="Hacking" value={dev.stat_hacking} />
                <StatBar label="Trading" value={dev.stat_trading} />
                <StatBar label="Social" value={dev.stat_social} />
                <StatBar label="Endurance" value={dev.stat_endurance} />
                <StatBar label="Luck" value={dev.stat_luck} />
              </div>
            </div>
          )}

          {/* Personality Traits */}
          {hasTraits && (
            <div className="win-panel" style={{ flex: 1, padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--terminal-cyan)' }}>
                PERSONALITY
              </div>
              <TraitRow label="Alignment" value={dev.alignment} />
              <TraitRow label="Risk Level" value={dev.risk_level} />
              <TraitRow label="Social Style" value={dev.social_style} />
              <TraitRow label="Coding Style" value={dev.coding_style} />
              <TraitRow label="Work Ethic" value={dev.work_ethic} />
            </div>
          )}
        </div>
      )}

      {/* ── Accumulated Stats ── */}
      <div className="stats-grid" style={{ padding: '4px 6px' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">Earned</div>
          <div className="stat-value" style={{ color: 'var(--gold)', fontSize: '12px' }}>
            {formatNumber(dev.total_earned)}
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Spent</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>
            {formatNumber(dev.total_spent)}
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Protocols</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>
            {dev.protocols_created || 0}
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">AIs</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>
            {dev.ais_created || 0}
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Reviews</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>
            {dev.code_reviews_done || 0}
          </div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Bugs</div>
          <div className="stat-value" style={{ fontSize: '12px' }}>
            {dev.bugs_found || 0}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="win-tabs">
        {['history', 'protocols', 'ais', 'investments', 'messages'].map(t => (
          <button key={t} className={`win-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tabLoading ? (
          <div className="loading">Loading...</div>
        ) : tab === 'history' ? (
          <div className="terminal" style={{ minHeight: 100 }}>
            {tabData.length === 0 && <div style={{ color: 'var(--terminal-amber)' }}>No history yet. Simulation is in pre-launch.</div>}
            {tabData.map((item, i) => (
              <div key={i} className="terminal-line">
                <span style={{ color: 'var(--terminal-amber)' }}>[{formatTime(item.created_at)}]</span>{' '}
                <span style={{ color: 'var(--terminal-cyan)' }}>{item.action_type}</span>{' '}
                <span>{item.details || ''}</span>
              </div>
            ))}
          </div>
        ) : tab === 'messages' ? (
          <div className="terminal" style={{ minHeight: 100 }}>
            {tabData.length === 0 && <div style={{ color: 'var(--terminal-amber)' }}>No messages yet</div>}
            {tabData.map((msg, i) => (
              <div key={i} className="terminal-line">
                <span style={{ color: 'var(--border-dark)' }}>[{formatTime(msg.created_at)}]</span>{' '}
                <span style={{ color: 'var(--terminal-green)' }}>{msg.message || msg.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <table className="win-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>{tab === 'investments' ? 'Amount' : 'Info'}</th>
              </tr>
            </thead>
            <tbody>
              {tabData.length === 0 && (
                <tr><td colSpan="2" style={{ textAlign: 'center', color: '#999' }}>None yet</td></tr>
              )}
              {tabData.map((item, i) => (
                <tr key={i}>
                  <td>{item.name || item.protocol_name || `Item ${i + 1}`}</td>
                  <td>
                    {tab === 'investments'
                      ? `${formatNumber(item.amount)} $NXT`
                      : item.description || item.value || '-'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
