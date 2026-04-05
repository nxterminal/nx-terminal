import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { useDevCount } from '../../../hooks/useDevCount';

// ── Difficulty config ───────────────────────────────────────
const DIFF_COLORS = {
  easy: '#005500',
  medium: '#b8860b',
  hard: '#aa0000',
  extreme: '#8b00ff',
  legendary: '#ff8c00',
};

const DIFF_LABELS = {
  easy: 'EASY (1 hour)',
  medium: 'MEDIUM (2-4 hours)',
  hard: 'HARD (6-12 hours)',
  extreme: 'EXTREME (12-24 hours)',
  legendary: 'LEGENDARY (24 hours)',
};

const DIFF_ORDER = ['easy', 'medium', 'hard', 'extreme', 'legendary'];

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

// ── Stat name for display ───────────────────────────────────
const STAT_NAMES = {
  coding: 'COD', hacking: 'HAK', trading: 'TRD', social: 'SOC', endurance: 'END',
};
const STAT_KEYS = {
  coding: 'stat_coding', hacking: 'stat_hacking', trading: 'stat_trading',
  social: 'stat_social', endurance: 'stat_endurance',
};


// ── Dev Select Modal ────────────────────────────────────────
function DevSelectModal({ mission, devs, onSelect, onClose, busy }) {
  const reqStat = mission.min_stat;
  const reqVal = mission.min_stat_value || 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div className="win-raised" style={{
        width: 420, maxHeight: '80vh', overflow: 'auto', padding: '12px',
        background: 'var(--surface, #c0c0c0)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
          Select Dev for: {mission.title}
        </div>
        {reqStat && (
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>
            Requires: {STAT_NAMES[reqStat] || reqStat} &ge; {reqVal}
          </div>
        )}
        {devs.length === 0 && (
          <div style={{ fontSize: '11px', color: '#aa0000', padding: '12px 0' }}>
            No available devs. All devs may be on missions.
          </div>
        )}
        {devs.map(dev => {
          const statKey = reqStat ? STAT_KEYS[reqStat] : null;
          const devStatVal = statKey ? (dev[statKey] || 0) : 999;
          const meetsReq = devStatVal >= reqVal;
          return (
            <div key={dev.token_id} className="win-raised" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px', marginBottom: '3px',
              opacity: meetsReq ? 1 : 0.4,
              cursor: meetsReq ? 'pointer' : 'not-allowed',
            }} onClick={() => meetsReq && !busy && onSelect(dev)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{dev.name}</span>
                <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>[{dev.archetype}]</span>
                {statKey && (
                  <span style={{
                    fontSize: '9px', marginLeft: '6px',
                    color: meetsReq ? '#005500' : '#aa0000', fontWeight: 'bold',
                  }}>
                    {STAT_NAMES[reqStat]}: {devStatVal}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '9px', color: '#666' }}>
                E:{dev.energy}/{dev.max_energy}
              </span>
              {meetsReq ? (
                <button className="win-btn" style={{ fontSize: '9px', padding: '2px 8px' }} disabled={busy}>
                  SEND
                </button>
              ) : (
                <span style={{ fontSize: '8px', color: '#aa0000' }}>Stat too low</span>
              )}
            </div>
          );
        })}
        <div style={{ textAlign: 'right', marginTop: '8px' }}>
          <button className="win-btn" onClick={onClose} style={{ fontSize: '10px', padding: '3px 12px' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Confirm Modal ───────────────────────────────────────────
function ConfirmModal({ mission, dev, onConfirm, onClose, busy }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 10001,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div className="win-raised" style={{
        width: 380, padding: '16px',
        background: 'var(--surface, #c0c0c0)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
          Confirm Mission
        </div>
        <div style={{ fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
          Send <b>{dev.name}</b> on "<b>{mission.title}</b>"?
          <br /><br />
          They will be unavailable for <b>{mission.duration_hours}h</b>.
          <br />
          Reward: <b style={{ color: '#7a5c00' }}>+{mission.reward_nxt} $NXT</b>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="win-btn" onClick={onClose} style={{ fontSize: '10px', padding: '3px 12px' }}>
            Cancel
          </button>
          <button className="win-btn" onClick={onConfirm} disabled={busy}
            style={{ fontSize: '10px', padding: '3px 12px', fontWeight: 'bold', color: '#005500' }}>
            {busy ? 'Sending...' : 'CONFIRM'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Mission Card ────────────────────────────────────────────
function MissionCard({ mission, onSelectDev }) {
  const diffColor = DIFF_COLORS[mission.difficulty] || '#666';
  return (
    <div className="win-raised" style={{ padding: '8px 10px', marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-primary)' }}>
            {mission.title}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary, #666)', marginTop: '2px', lineHeight: '1.3' }}>
            "{mission.description}"
          </div>
          <div style={{ fontSize: '9px', color: '#888', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>Duration: {mission.duration_hours}h</span>
            {mission.min_stat && (
              <span>Requires: {STAT_NAMES[mission.min_stat] || mission.min_stat} &ge; {mission.min_stat_value}</span>
            )}
            {!mission.min_stat && <span>Any dev can go</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{ fontWeight: 'bold', color: '#7a5c00', fontSize: '12px' }}>
            +{mission.reward_nxt} $NXT
          </div>
          <button className="win-btn" onClick={() => onSelectDev(mission)}
            style={{ fontSize: '9px', padding: '2px 8px', marginTop: '4px' }}>
            SELECT DEV & START
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
  const diffColor = DIFF_COLORS[mission.difficulty] || '#666';

  return (
    <div className="win-raised" style={{ padding: '8px 10px', marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>{completed ? '\u2705' : '\u23F3'}</span>
            <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{mission.title}</span>
            {completed && <span style={{ fontSize: '9px', color: '#005500', fontWeight: 'bold' }}>COMPLETED</span>}
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
            Dev: <b>{mission.dev_name || `#${mission.dev_token_id}`}</b>
            {mission.dev_archetype && <span style={{ color: '#888' }}> [{mission.dev_archetype}]</span>}
          </div>
          {!completed && (
            <>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                Time remaining: {timeLeft}
              </div>
              {/* Progress bar */}
              <div style={{
                height: 8, background: 'var(--border-dark, #888)', marginTop: '4px',
                borderRadius: '2px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: diffColor, transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ fontSize: '8px', color: '#888', marginTop: '1px' }}>{pct}%</div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 'bold', color: '#7a5c00', fontSize: '11px' }}>
            +{mission.reward_nxt} $NXT
          </span>
          {completed ? (
            <button className="win-btn" onClick={() => onClaim(mission)} disabled={busy}
              style={{ fontSize: '10px', padding: '3px 10px', fontWeight: 'bold', color: '#005500', border: '2px solid #005500' }}>
              CLAIM REWARD
            </button>
          ) : (
            <button className="win-btn" onClick={() => onAbandon(mission)} disabled={busy}
              style={{ fontSize: '8px', padding: '1px 6px', color: '#aa0000' }}>
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
  const [tab, setTab] = useState('available'); // available | active | history
  const [missions, setMissions] = useState([]);
  const [availableDevs, setAvailableDevs] = useState([]);
  const [activeMissions, setActiveMissions] = useState([]);
  const [historyMissions, setHistoryMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Dev select modal state
  const [selectingMission, setSelectingMission] = useState(null);
  const [confirmDev, setConfirmDev] = useState(null);

  const { devCount, tier } = useDevCount();
  const address = localStorage.getItem('nx-wallet');

  // ── Fetch data ──────────────────────────────────────────
  const fetchAvailable = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMissionsAvailable(address);
      setMissions(data.missions || []);
      setAvailableDevs(data.available_devs || []);
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

  // Auto-refresh active missions every 60s
  useEffect(() => {
    if (tab !== 'active') return;
    const interval = setInterval(fetchActive, 60000);
    return () => clearInterval(interval);
  }, [tab, fetchActive]);

  // ── Actions ─────────────────────────────────────────────
  const handleStartMission = async (mission, dev) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await api.startMission(address, mission.id, dev.token_id);
      setFeedback({ text: result.message, color: '#005500' });
      setSelectingMission(null);
      setConfirmDev(null);
      fetchAvailable();
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to start mission', color: '#aa0000' });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleClaim = async (mission) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await api.claimMission(address, mission.player_mission_id);
      setFeedback({ text: result.message, color: '#005500' });
      fetchActive();
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to claim', color: '#aa0000' });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAbandon = async (mission) => {
    if (!confirm(`Abandon "${mission.title}"? No reward will be given.`)) return;
    setBusy(true);
    try {
      await api.abandonMission(address, mission.player_mission_id);
      setFeedback({ text: 'Mission abandoned.', color: '#b8860b' });
      fetchActive();
    } catch (e) {
      setFeedback({ text: e.message || 'Failed to abandon', color: '#aa0000' });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Group available missions by difficulty ──────────────
  const missionsByDiff = {};
  for (const m of missions) {
    missionsByDiff[m.difficulty] = missionsByDiff[m.difficulty] || [];
    missionsByDiff[m.difficulty].push(m);
  }

  if (!address) {
    return (
      <div style={{ padding: '20px', fontFamily: "'VT323', monospace", fontSize: '13px' }}>
        Connect your wallet to access Mission Control.
      </div>
    );
  }

  return (
    <div style={{ padding: '8px', fontFamily: "'VT323', monospace", fontSize: '12px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          &gt; MISSION CONTROL
        </div>
        {tier && (
          <span style={{ fontSize: '10px', color: '#888' }}>
            Your rank: {tier.label.toUpperCase()}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
        {['available', 'active', 'history'].map(t => (
          <button key={t} className="win-btn"
            onClick={() => setTab(t)}
            style={{
              fontSize: '10px', padding: '3px 12px',
              fontWeight: tab === t ? 'bold' : 'normal',
              background: tab === t ? 'var(--surface-highlight, #dfdfdf)' : undefined,
            }}>
            {t === 'available' ? 'Available' : t === 'active' ? `Active (${activeMissions.length})` : 'History'}
          </button>
        ))}
        <button className="win-btn" onClick={() => {
          if (tab === 'available') fetchAvailable();
          else if (tab === 'active') fetchActive();
          else fetchHistory();
        }} style={{ fontSize: '10px', padding: '3px 8px', marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ fontSize: '10px', color: feedback.color, fontWeight: 'bold', marginBottom: '6px', padding: '4px 8px', background: 'var(--surface, #c0c0c0)', border: '1px solid ' + feedback.color }}>
          {feedback.text}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '10px', color: '#aa0000', marginBottom: '6px' }}>{error}</div>
      )}

      {loading && <div style={{ color: '#888', fontSize: '11px' }}>Loading...</div>}

      {/* ═══ AVAILABLE TAB ═══ */}
      {tab === 'available' && !loading && (
        <>
          {missions.length === 0 && (
            <div style={{ color: '#888', fontSize: '11px', padding: '12px 0' }}>
              No missions available right now. Check back later!
            </div>
          )}
          {DIFF_ORDER.map(diff => {
            const group = missionsByDiff[diff];
            if (!group || group.length === 0) return null;
            return (
              <div key={diff} style={{ marginBottom: '10px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 'bold', padding: '3px 6px', marginBottom: '4px',
                  color: DIFF_COLORS[diff], borderBottom: `1px solid ${DIFF_COLORS[diff]}`,
                }}>
                  {DIFF_LABELS[diff] || diff.toUpperCase()}
                </div>
                {group.map(m => (
                  <MissionCard key={m.id} mission={m} onSelectDev={setSelectingMission} />
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
            <div style={{ color: '#888', fontSize: '11px', padding: '12px 0' }}>
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
            <div style={{ color: '#888', fontSize: '11px', padding: '12px 0' }}>
              No mission history yet.
            </div>
          )}
          {historyMissions.map((m, i) => (
            <div key={i} className="win-raised" style={{
              padding: '6px 8px', marginBottom: '3px', fontSize: '10px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: m.status === 'abandoned' ? 0.5 : 1,
            }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>{m.title}</span>
                <span style={{ color: '#888', marginLeft: '8px' }}>{m.dev_name || `#${m.dev_token_id}`}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: DIFF_COLORS[m.difficulty] || '#666', fontSize: '9px', textTransform: 'uppercase' }}>
                  {m.difficulty}
                </span>
                {m.status === 'claimed' ? (
                  <span style={{ color: '#7a5c00', fontWeight: 'bold' }}>+{m.reward_nxt} $NXT</span>
                ) : (
                  <span style={{ color: '#aa0000' }}>Abandoned</span>
                )}
                <span style={{ color: '#888', fontSize: '9px' }}>{formatDate(m.claimed_at || m.ends_at)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══ DEV SELECT MODAL ═══ */}
      {selectingMission && !confirmDev && (
        <DevSelectModal
          mission={selectingMission}
          devs={availableDevs}
          busy={busy}
          onSelect={(dev) => setConfirmDev(dev)}
          onClose={() => setSelectingMission(null)}
        />
      )}

      {/* ═══ CONFIRM MODAL ═══ */}
      {selectingMission && confirmDev && (
        <ConfirmModal
          mission={selectingMission}
          dev={confirmDev}
          busy={busy}
          onConfirm={() => handleStartMission(selectingMission, confirmDev)}
          onClose={() => setConfirmDev(null)}
        />
      )}
    </div>
  );
}
