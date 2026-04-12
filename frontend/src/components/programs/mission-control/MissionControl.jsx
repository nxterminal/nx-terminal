import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { useDevCount } from '../../../hooks/useDevCount';
import { useWallet } from '../../../hooks/useWallet';

// ── Constants ──────────────────────────────────────────────
const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

const ARCHETYPE_COLORS = {
  Degen: '#ff6600', Builder: '#0077cc', Hacker: '#00cc44',
  Influencer: '#cc00cc', Trader: '#ccaa00', Artist: '#cc3366',
};

const DIFF_COLORS = {
  easy: '#00cc00',
  medium: '#ffaa00',
  hard: '#ff4444',
  extreme: '#cc66ff',
  legendary: '#ffd700',
};

const DIFF_BADGE = {
  easy:      { bg: '#003300', text: '#00cc00' },
  medium:    { bg: '#332200', text: '#ffaa00' },
  hard:      { bg: '#330000', text: '#ff4444' },
  extreme:   { bg: '#1a0033', text: '#cc66ff' },
  legendary: { bg: '#332200', text: '#ffd700' },
};

const DIFF_LABELS = {
  easy: 'EASY (1 hour)',
  medium: 'MEDIUM (2-4 hours)',
  hard: 'HARD (6-12 hours)',
  extreme: 'EXTREME (12-24 hours)',
  legendary: 'LEGENDARY (24 hours)',
};

const DIFF_ORDER = ['easy', 'medium', 'hard', 'legendary'];

const STAT_NAMES = {
  coding: 'COD', hacking: 'HAK', trading: 'TRD', social: 'SOC', endurance: 'END',
};
const STAT_KEYS = {
  coding: 'stat_coding', hacking: 'stat_hacking', trading: 'stat_trading',
  social: 'stat_social', endurance: 'stat_endurance',
};

// ── Dark theme tokens ──────────────────────────────────────
const T = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  cardBorder: '#2a2a3e',
  cardHover: '#22223a',
  text: '#e0e0e0',
  textMuted: '#888',
  textDim: '#666',
  cyan: '#00e5ff',
  gold: '#ffd700',
  green: '#00ff00',
  greenDark: '#003300',
  greenMid: '#00cc00',
  amber: '#ffcc00',
  red: '#ff4444',
  surface: '#141428',
};

function formatTimeRemaining(endsAt) {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end - now;
  if (diff <= 0) return 'COMPLETED';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function progressPct(startedAt, endsAt) {
  const now = Date.now();
  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now >= end) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

// ── Small reusable components ──────────────────────────────
function DiffBadge({ difficulty }) {
  const badge = DIFF_BADGE[difficulty] || { bg: '#222', text: '#888' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '10px',
      background: badge.bg, color: badge.text,
      fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
    }}>
      {difficulty}
    </span>
  );
}

function DevAvatar({ dev, size = 48 }) {
  const imgUrl = dev.ipfs_hash ? `${IPFS_GW}${dev.ipfs_hash}` : null;
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#0a0a14', border: '1px solid #333', overflow: 'hidden',
    }}>
      {imgUrl ? (
        <img src={imgUrl} alt={dev.name || ''} style={{
          width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated',
        }} />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--text-secondary)', fontSize: size * 0.4,
        }}>@</div>
      )}
    </div>
  );
}


// ── Dev Select Modal ───────────────────────────────────────
function DevSelectModal({ mission, devs, onSelect, onClose, busy, cooldowns }) {
  const reqStat = mission.min_stat;
  const reqVal = mission.min_stat_value || 0;
  const required = mission.required_devs || 1;
  const [selected, setSelected] = useState([]);

  // Count eligible devs (meet stat req + not on cooldown)
  const eligibleCount = devs.filter(dev => {
    const statKey = reqStat ? STAT_KEYS[reqStat] : null;
    const meetsReq = statKey ? (dev[statKey] || 0) >= reqVal : true;
    const onCd = (cooldowns || []).some(c => c.dev_token_id === dev.token_id && c.mission_id === mission.id);
    return meetsReq && !onCd;
  }).length;
  const notEnough = eligibleCount < required;

  const sortedDevs = [...devs].sort((a, b) => {
    const statKey = reqStat ? STAT_KEYS[reqStat] : null;
    const aVal = statKey ? (a[statKey] || 0) : 999;
    const bVal = statKey ? (b[statKey] || 0) : 999;
    const aMeets = aVal >= reqVal;
    const bMeets = bVal >= reqVal;
    const aCd = (cooldowns || []).some(c => c.dev_token_id === a.token_id && c.mission_id === mission.id);
    const bCd = (cooldowns || []).some(c => c.dev_token_id === b.token_id && c.mission_id === mission.id);
    if (aMeets && !aCd && (!bMeets || bCd)) return -1;
    if (bMeets && !bCd && (!aMeets || aCd)) return 1;
    return bVal - aVal;
  });

  const toggleDev = (dev) => {
    setSelected(prev => {
      if (prev.some(d => d.token_id === dev.token_id)) {
        return prev.filter(d => d.token_id !== dev.token_id);
      }
      if (prev.length >= required) return prev;
      return [...prev, dev];
    });
  };

  // For single-dev, click selects immediately (legacy behavior)
  const handleDevClick = (dev) => {
    if (required === 1) {
      onSelect([dev]);
    } else {
      toggleDev(dev);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 540, maxHeight: '80vh', overflow: 'auto', padding: '16px',
        background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
        fontFamily: "'VT323', monospace",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '16px', color: T.cyan }}>
          Select {required > 1 ? `${required} devs` : 'a Dev'} for: {mission.title}
        </div>
        {required > 1 && (
          <div style={{
            fontSize: '14px', marginBottom: '8px', fontWeight: 'bold',
            color: selected.length === required ? '#44ff44' : '#ffaa00',
          }}>
            {selected.length}/{required} SELECTED
          </div>
        )}
        {reqStat && (
          <div style={{ fontSize: '12px', color: T.textMuted, marginBottom: '10px' }}>
            Requires: {STAT_NAMES[reqStat] || reqStat} &ge; {reqVal}
          </div>
        )}
        {notEnough && devs.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            {reqStat && eligibleCount < required && devs.length >= required ? (
              <>
                <div style={{ fontSize: 16, color: '#ff9800', marginBottom: 8 }}>NOT ENOUGH QUALIFIED DEVS</div>
                <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
                  Requires {required} dev{required > 1 ? 's' : ''} with {(STAT_NAMES[reqStat] || reqStat).toUpperCase()} &ge; {reqVal}.
                  <br/>{eligibleCount} of {devs.length} available dev{devs.length !== 1 ? 's' : ''} qualify.
                  <br/><span style={{ color: T.textDim, fontSize: 12 }}>Train your devs to increase their {(STAT_NAMES[reqStat] || reqStat).toUpperCase()} stat.</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, color: T.red, marginBottom: 8 }}>NOT ENOUGH AVAILABLE DEVS</div>
                <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
                  This mission requires {required} dev{required > 1 ? 's' : ''}.
                  <br/>You have {eligibleCount} eligible dev{eligibleCount !== 1 ? 's' : ''} available.
                </div>
              </>
            )}
          </div>
        )}
        {devs.length === 0 && (
          <div style={{ fontSize: '13px', color: T.red, padding: '12px 0' }}>
            No available devs. All devs may be on missions.
          </div>
        )}
        {sortedDevs.map(dev => {
          const statKey = reqStat ? STAT_KEYS[reqStat] : null;
          const devStatVal = statKey ? (dev[statKey] || 0) : 999;
          const meetsReq = devStatVal >= reqVal;

          const devCooldown = (cooldowns || []).find(
            c => c.dev_token_id === dev.token_id && c.mission_id === mission.id
          );
          let cooldownHoursLeft = 0;
          if (devCooldown) {
            const avail = new Date(new Date(devCooldown.claimed_at).getTime() + 24 * 3600000);
            cooldownHoursLeft = Math.max(1, Math.ceil((avail - new Date()) / 3600000));
          }
          const onCooldown = cooldownHoursLeft > 0;
          const canSelect = meetsReq && !onCooldown;
          const isSelected = selected.some(d => d.token_id === dev.token_id);
          const isFull = selected.length >= required && !isSelected;

          return (
            <div key={dev.token_id} style={{
              display: 'flex', gap: '10px', padding: '10px',
              marginBottom: '6px', background: T.card,
              border: isSelected ? '2px solid #44ff44' : `1px solid ${T.cardBorder}`,
              opacity: canSelect && !isFull ? 1 : (isSelected ? 1 : 0.45),
              cursor: canSelect && !isFull ? 'pointer' : (isSelected ? 'pointer' : 'default'),
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => canSelect && !isFull && (e.currentTarget.style.borderColor = isSelected ? '#44ff44' : T.cyan)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = isSelected ? '#44ff44' : T.cardBorder)}
              onClick={() => {
                if (busy) return;
                if (isSelected) { toggleDev(dev); return; }
                if (canSelect && !isFull) handleDevClick(dev);
              }}
            >
              <DevAvatar dev={dev} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: T.text }}>{dev.name}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 'bold',
                    color: ARCHETYPE_COLORS[dev.archetype] || T.textMuted,
                  }}>[{dev.archetype}]</span>
                  {isSelected && <span style={{ color: '#44ff44', fontWeight: 'bold', fontSize: '14px' }}>✓</span>}
                </div>
                <div style={{ fontSize: '11px', color: T.textDim, marginTop: '2px' }}>
                  {dev.corporation && <span>{dev.corporation.replace(/_/g, ' ').toUpperCase()}</span>}
                  {dev.rarity_tier && dev.rarity_tier !== 'common' && (
                    <span style={{ color: T.gold, fontWeight: 'bold', marginLeft: '6px', textTransform: 'uppercase' }}>
                      {dev.rarity_tier}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['coding', 'hacking', 'trading', 'social', 'endurance'].map(s => {
                    const val = dev[STAT_KEYS[s]] || 0;
                    const isRequired = s === reqStat;
                    const meets = !isRequired || val >= reqVal;
                    return (
                      <span key={s} style={{
                        fontWeight: isRequired ? 'bold' : 'normal',
                        color: isRequired ? (meets ? T.greenMid : T.red) : T.textDim,
                      }}>
                        {STAT_NAMES[s]}:{val}
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: '11px', color: T.textDim, marginTop: '2px' }}>
                  ENERGY: {dev.energy}/{dev.max_energy} | PC: {dev.pc_health ?? 100}%
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                justifyContent: 'center', gap: '4px',
              }}>
                {onCooldown ? (
                  <span style={{ fontSize: '12px', color: '#ffaa00', fontWeight: 'bold' }}>
                    &#9203; Cooldown: ~{cooldownHoursLeft}h
                  </span>
                ) : !meetsReq ? (
                  <span style={{ fontSize: '11px', color: T.red }}>
                    {reqStat && `${STAT_NAMES[reqStat] || reqStat} too low`}
                  </span>
                ) : required === 1 ? (
                  <button className="win-btn" disabled={busy}
                    style={{
                      fontSize: '13px', padding: '6px 14px', fontWeight: 'bold',
                      background: '#00332a', color: T.cyan, border: `1px solid ${T.cyan}`,
                      cursor: 'pointer',
                    }}>
                    SELECT
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="win-btn" onClick={onClose}
            style={{ fontSize: '13px', padding: '6px 16px', color: T.textMuted }}>
            Cancel
          </button>
          {required > 1 && (
            <button className="win-btn"
              disabled={selected.length !== required || busy}
              onClick={() => onSelect(selected)}
              style={{
                fontSize: '14px', padding: '8px 20px', fontWeight: 'bold',
                background: selected.length === required ? '#00332a' : '#222',
                color: selected.length === required ? T.green : '#555',
                border: `1px solid ${selected.length === required ? T.greenMid : '#333'}`,
                cursor: selected.length === required ? 'pointer' : 'default',
              }}>
              START MISSION ({selected.length}/{required})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Confirm Modal ───────────────────────────────────────────
function ConfirmModal({ mission, devs, onConfirm, onClose, busy }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      zIndex: 10001,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 420, padding: '20px',
        background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
        fontFamily: "'VT323', monospace",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '16px', color: T.cyan }}>
          Confirm Mission
        </div>
        <div style={{ marginBottom: '14px' }}>
          {devs.map(dev => (
            <div key={dev.token_id} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
              <DevAvatar dev={dev} size={36} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{dev.name}</div>
                <div style={{ fontSize: '11px', color: ARCHETYPE_COLORS[dev.archetype] || T.textMuted }}>
                  [{dev.archetype}]
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '13px', marginBottom: '14px', lineHeight: '1.5', color: '#ccc' }}>
          Send {devs.length > 1 ? `${devs.length} devs` : devs[0]?.name} on "<b style={{ color: T.cyan }}>{mission.title}</b>"
          <br />
          Unavailable for <b>{mission.duration_hours}h</b>
          <br />
          Reward: <b style={{ color: T.gold }}>+{mission.reward_nxt} $NXT</b>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="win-btn" onClick={onClose}
            style={{ fontSize: '13px', padding: '6px 16px', color: T.textMuted }}>
            Cancel
          </button>
          <button className="win-btn" onClick={onConfirm} disabled={busy}
            style={{
              fontSize: '14px', padding: '8px 20px', fontWeight: 'bold',
              background: T.greenDark, color: T.green, border: `1px solid ${T.greenMid}`,
              cursor: 'pointer',
            }}>
            {busy ? 'Sending...' : 'CONFIRM MISSION'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Mission Card ────────────────────────────────────────────
function MissionCard({ mission, onSelectDev, devCount }) {
  const [hovered, setHovered] = useState(false);
  const diffColor = DIFF_COLORS[mission.difficulty] || '#888';

  return (
    <div style={{
      padding: '10px 12px', marginBottom: '6px',
      background: T.card,
      border: `1px solid ${hovered ? diffColor : T.cardBorder}`,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: T.cyan }}>
              {mission.title}
            </span>
            <DiffBadge difficulty={mission.difficulty} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3', fontStyle: 'italic' }}>
            "{mission.description}"
          </div>
          <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>{mission.duration_hours}h</span>
            {mission.min_stat && (
              <span>{STAT_NAMES[mission.min_stat] || mission.min_stat} &ge; {mission.min_stat_value}</span>
            )}
            {!mission.min_stat && <span>Any dev</span>}
            {mission.min_devs_owned > 1 && (
              <span>{mission.min_devs_owned}+ devs owned</span>
            )}
            {mission.required_devs > 1 && (
              <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>Send: {mission.required_devs} devs</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 110, flexShrink: 0 }}>
          <div style={{ fontWeight: 'bold', color: T.gold, fontSize: '14px' }}>
            +{mission.reward_nxt} $NXT
          </div>
          <button className="win-btn" onClick={() => onSelectDev(mission)}
            style={{
              fontSize: '13px', padding: '6px 14px', marginTop: '6px', fontWeight: 'bold',
              background: '#00332a', color: T.cyan, border: `1px solid ${T.cyan}`,
              cursor: 'pointer', borderRadius: '2px',
            }}>
            {mission.required_devs > 1 ? `SELECT ${mission.required_devs} DEVS & START` : 'SELECT DEV & START'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Active Mission Card ─────────────────────────────────────
function ActiveMissionCard({ mission, onClaim, onAbandon, busy }) {
  const timeLeft = formatTimeRemaining(mission.ends_at);
  const pct = progressPct(mission.started_at, mission.ends_at);
  const completed = pct >= 100;
  const diffColor = DIFF_COLORS[mission.difficulty] || '#888';

  return (
    <div style={{
      padding: '10px 12px', marginBottom: '6px',
      background: T.card,
      border: completed ? `1px solid ${T.greenMid}` : `1px solid ${T.cardBorder}`,
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Dev avatar */}
        <DevAvatar dev={{ ipfs_hash: mission.dev_ipfs_hash, name: mission.dev_name }} size={40} />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px' }}>{completed ? '\u2705' : '\u23F3'}</span>
            <span style={{ fontWeight: 'bold', fontSize: '16px', color: T.cyan }}>{mission.title}</span>
            <DiffBadge difficulty={mission.difficulty} />
            {completed && <span style={{ fontSize: '12px', color: T.greenMid, fontWeight: 'bold' }}>COMPLETED</span>}
          </div>
          <div style={{ fontSize: '13px', color: T.textMuted, marginTop: '4px' }}>
            Dev: <b style={{ color: T.text }}>{mission.dev_name || `#${mission.dev_token_id}`}</b>
            {mission.dev_archetype && <span style={{ color: T.textDim }}> [{mission.dev_archetype}]</span>}
            <span style={{ marginLeft: '10px', color: T.textDim }}>
              Duration: {mission.duration_hours}h | Started: {formatDate(mission.started_at)}
            </span>
          </div>
          {!completed && (
            <>
              <div style={{ fontSize: '12px', color: T.amber, marginTop: '4px', fontWeight: 'bold' }}>
                Time remaining: {timeLeft}
              </div>
              <div style={{
                height: 12, background: '#1a1a2e', marginTop: '6px',
                borderRadius: '2px', overflow: 'hidden', border: `1px solid ${T.cardBorder}`,
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: diffColor, transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ fontSize: '11px', color: T.textDim, marginTop: '2px' }}>{pct}%</div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 'bold', color: T.gold, fontSize: '14px' }}>
            +{mission.reward_nxt} $NXT
          </span>
          {completed ? (
            <button className="win-btn" onClick={() => onClaim(mission)} disabled={busy}
              style={{
                fontSize: '14px', padding: '8px 18px', fontWeight: 'bold',
                background: T.greenDark, color: T.green, border: `1px solid ${T.greenMid}`,
                cursor: 'pointer',
              }}>
              &#128176; CLAIM +{mission.reward_nxt} $NXT
            </button>
          ) : (
            <button className="win-btn" onClick={() => onAbandon(mission)} disabled={busy}
              style={{ fontSize: '11px', padding: '3px 10px', color: T.red, border: `1px solid ${T.red}40` }}>
              Abandon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function MissionControl() {
  const [tab, setTab] = useState('available');
  const [missions, setMissions] = useState([]);
  const [availableDevs, setAvailableDevs] = useState([]);
  const [cooldowns, setCooldowns] = useState([]);
  const [activeMissions, setActiveMissions] = useState([]);
  const [historyMissions, setHistoryMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectingMission, setSelectingMission] = useState(null);
  const [confirmDevs, setConfirmDevs] = useState(null);

  const { devCount, tier } = useDevCount();
  const { address, isConnected } = useWallet();

  // ── Fetch data ──────────────────────────────────────────
  const fetchAvailable = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMissionsAvailable(address);
      setMissions(data.missions || []);
      setAvailableDevs(data.available_devs || []);
      setCooldowns(data.cooldowns || []);
    } catch (e) {
      setError('Failed to load missions: ' + e.message);
    }
    setLoading(false);
  }, [address]);

  const fetchActive = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await api.getMissionsActive(address);
      setActiveMissions(data || []);
    } catch (e) {
      setError('Failed to load active missions: ' + e.message);
    }
    setLoading(false);
  }, [address]);

  const fetchHistory = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await api.getMissionsHistory(address);
      setHistoryMissions(data || []);
    } catch (e) {
      setError('Failed to load history: ' + e.message);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    if (tab === 'available') fetchAvailable();
    else if (tab === 'active') fetchActive();
    else if (tab === 'history') fetchHistory();
  }, [tab, fetchAvailable, fetchActive, fetchHistory]);

  useEffect(() => {
    if (tab !== 'active') return;
    const interval = setInterval(fetchActive, 60000);
    return () => clearInterval(interval);
  }, [tab, fetchActive]);

  // ── Actions ─────────────────────────────────────────────
  const handleStartMission = async (mission, devs) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await api.startMission(address, mission.id, devs.map(d => d.token_id));
      setFeedback({ text: result.message, color: T.greenMid });
      setSelectingMission(null);
      setConfirmDevs(null);
      fetchAvailable();
      window.dispatchEvent(new Event('nx-devs-refresh'));
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to start mission', color: T.red });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleClaim = async (mission) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await api.claimMission(address, mission.player_mission_id);
      setFeedback({
        text: result.message || `+${mission.reward_nxt} $NXT claimed!`,
        subtext: 'Withdraw to your wallet from NXT Wallet \u2192 COLLECT',
        color: T.greenMid,
      });
      fetchActive();
      window.dispatchEvent(new Event('nx-devs-refresh'));
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to claim', color: T.red });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleAbandon = async (mission) => {
    if (!confirm(`Abandon "${mission.title}"? No reward will be given.`)) return;
    setBusy(true);
    try {
      await api.abandonMission(address, mission.player_mission_id);
      setFeedback({ text: 'Mission abandoned.', color: '#ffaa00' });
      fetchActive();
      window.dispatchEvent(new Event('nx-devs-refresh'));
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to abandon', color: T.red });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 5000);
  };

  // ── Group available missions by difficulty ──────────────
  const missionsByDiff = {};
  for (const m of missions) {
    missionsByDiff[m.difficulty] = missionsByDiff[m.difficulty] || [];
    missionsByDiff[m.difficulty].push(m);
  }

  // Count claimable missions for tab badge
  const claimableCount = activeMissions.filter(m => new Date(m.ends_at) <= new Date()).length;

  if (!isConnected || !address) {
    return (
      <div style={{ padding: '20px', fontFamily: "'VT323', monospace", fontSize: '14px', background: T.bg, color: T.text, height: '100%' }}>
        Connect your wallet to access Mission Control.
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'VT323', monospace", fontSize: '13px',
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: T.bg, color: T.text,
    }}>
      {/* Header — fixed */}
      <div style={{ flexShrink: 0, padding: '8px 10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px', color: T.cyan }}>
          &gt; MISSION CONTROL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {tier && (
            <span style={{ fontSize: '12px', color: T.textMuted }}>
              Rank: {tier.label.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: '12px', color: T.textDim }}>
            {availableDevs.length} devs available
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0px', marginBottom: '8px', borderBottom: `1px solid ${T.cardBorder}` }}>
        {[
          { key: 'available', label: 'Available' },
          { key: 'active', label: `Active${activeMissions.length ? ` (${activeMissions.length})` : ''}` },
          { key: 'history', label: 'History' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontSize: '13px', padding: '5px 14px',
              fontWeight: tab === t.key ? 'bold' : 'normal',
              color: tab === t.key ? T.cyan : T.textMuted,
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? `2px solid ${T.cyan}` : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: "'VT323', monospace",
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            {t.label}
            {t.key === 'active' && claimableCount > 0 && (
              <span style={{
                background: T.green, color: '#000', padding: '0 5px',
                borderRadius: '8px', fontSize: '11px', fontWeight: 'bold',
              }}>{claimableCount}</span>
            )}
          </button>
        ))}
        <button onClick={() => {
          if (tab === 'available') fetchAvailable();
          else if (tab === 'active') fetchActive();
          else fetchHistory();
        }} style={{
          fontSize: '13px', padding: '6px 12px', marginLeft: 'auto',
          background: 'transparent', border: `1px solid ${T.cardBorder}`,
          color: T.textMuted, cursor: 'pointer',
          fontFamily: "'VT323', monospace",
        }}>
          Refresh
        </button>
      </div>
      </div>{/* end fixed header */}

      {/* Scrollable content */}
      <div className="mc-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'scroll', padding: '0 10px 8px' }}>

      {/* Feedback */}
      {feedback && (
        <div style={{
          fontSize: '13px', fontWeight: 'bold', marginBottom: '10px',
          padding: '8px 12px', border: `1px solid ${feedback.color}`,
          background: `${feedback.color}15`,
          color: feedback.color,
        }}>
          {feedback.text}
          {feedback.subtext && (
            <div style={{ fontSize: '11px', fontWeight: 'normal', color: T.textMuted, marginTop: '3px' }}>
              {feedback.subtext}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: T.red, marginBottom: '8px' }}>{error}</div>
      )}

      {loading && <div style={{ color: T.textMuted, fontSize: '13px' }}>Loading...</div>}

      {/* ═══ AVAILABLE TAB ═══ */}
      {tab === 'available' && !loading && (
        <>
          {missions.length === 0 && (
            <div style={{ color: T.textMuted, fontSize: '13px', padding: '12px 0' }}>
              No missions available right now. Check back later!
            </div>
          )}
          {DIFF_ORDER.map(diff => {
            const group = missionsByDiff[diff];
            if (!group || group.length === 0) return null;
            const diffColor = DIFF_COLORS[diff];
            return (
              <div key={diff} style={{ marginBottom: '8px' }}>
                <div style={{
                  fontSize: '13px', fontWeight: 'bold', padding: '4px 8px', marginBottom: '4px',
                  color: diffColor, borderBottom: `1px solid ${diffColor}40`,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <DiffBadge difficulty={diff} />
                  <span style={{ color: T.textDim, fontWeight: 'normal', fontSize: '12px' }}>
                    {DIFF_LABELS[diff]}
                  </span>
                </div>
                {group.map(m => (
                  <MissionCard key={m.id} mission={m} onSelectDev={setSelectingMission} devCount={devCount} />
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* ═══ ACTIVE TAB ═══ */}
      {tab === 'active' && !loading && (
        <>
          {activeMissions.length === 0 && (
            <div style={{ color: T.textMuted, fontSize: '13px', padding: '12px 0' }}>
              No active missions. Send a dev on a mission from the Available tab!
            </div>
          )}
          {activeMissions.map(m => (
            <ActiveMissionCard key={m.player_mission_id} mission={m}
              onClaim={handleClaim} onAbandon={handleAbandon} busy={busy} />
          ))}
        </>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && !loading && (
        <>
          {historyMissions.length === 0 && (
            <div style={{ color: T.textMuted, fontSize: '13px', padding: '12px 0' }}>
              No mission history yet.
            </div>
          )}
          {historyMissions.map((m, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: '6px', fontSize: '13px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: T.card, border: `1px solid ${T.cardBorder}`,
              opacity: m.status === 'abandoned' ? 0.5 : 1,
            }}>
              <div>
                <span style={{ fontWeight: 'bold', color: T.text }}>{m.title}</span>
                <span style={{ color: T.textMuted, marginLeft: '8px' }}>{m.dev_name || `#${m.dev_token_id}`}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <DiffBadge difficulty={m.difficulty} />
                {m.status === 'claimed' ? (
                  <span style={{ color: T.gold, fontWeight: 'bold' }}>+{m.reward_nxt} $NXT</span>
                ) : (
                  <span style={{ color: T.red }}>Abandoned</span>
                )}
                <span style={{ color: T.textDim, fontSize: '11px' }}>{formatDate(m.claimed_at || m.ends_at)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══ DEV SELECT MODAL ═══ */}
      {selectingMission && !confirmDevs && (
        <DevSelectModal
          mission={selectingMission}
          devs={availableDevs}
          cooldowns={cooldowns}
          busy={busy}
          onSelect={(devs) => setConfirmDevs(devs)}
          onClose={() => setSelectingMission(null)}
        />
      )}

      {/* ═══ CONFIRM MODAL ═══ */}
      {confirmDevs && selectingMission && (
        <ConfirmModal
          mission={selectingMission}
          devs={confirmDevs}
          busy={busy}
          onConfirm={() => handleStartMission(selectingMission, confirmDevs)}
          onClose={() => setConfirmDevs(null)}
        />
      )}

      </div>{/* end scrollable content */}
    </div>
  );
}
