import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';
const T = { bg: '#0f0f1a', card: '#1a1a2e', cardBorder: '#2a2a3e', text: '#e0e0e0', textMuted: '#888', textDim: '#666', cyan: '#00e5ff', gold: '#ffd700', green: '#00ff00', red: '#ff4444' };

export default function DevCamp() {
  const { address, isConnected } = useWallet();
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState({ classes: [], courses: [] });
  const [trainingDevs, setTrainingDevs] = useState([]);
  const [myDevs, setMyDevs] = useState([]);
  const [selectedDev, setSelectedDev] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const refresh = useCallback(() => {
    if (!address) return;
    api.getTrainingCatalog().then(setCatalog).catch(() => {});
    api.getActiveTraining(address).then(d => setTrainingDevs(d.training_devs || [])).catch(() => {});
    api.getDevs({ owner: address }).then(d => setMyDevs(Array.isArray(d) ? d : d.devs || [])).catch(() => {});
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleBuy = async (itemId, cost) => {
    if (!selectedDev || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await api.buyItem(address, itemId, Number(selectedDev));
      window.dispatchEvent(new CustomEvent('nx-stat-animation', { detail: [{ stat: '$NXT', amount: -cost, type: 'spend' }] }));
      window.dispatchEvent(new Event('nx-devs-refresh'));
      setFeedback({ text: 'Training started!', color: T.green });
      setSelectedDev('');
      setTab('training');
      refresh();
    } catch (e) {
      setFeedback({ text: e.message || 'Failed', color: T.red });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleGraduate = async (devId) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.graduate(address, devId);
      const statName = res.stat?.replace('stat_', '').toUpperCase() || 'STAT';
      window.dispatchEvent(new CustomEvent('nx-stat-animation', { detail: [{ stat: statName, amount: res.bonus, type: 'gain' }] }));
      window.dispatchEvent(new Event('nx-devs-refresh'));
      setFeedback({ text: `Graduated! +${res.bonus} ${statName}`, color: T.green });
      refresh();
    } catch (e) {
      setFeedback({ text: e.message || 'Failed', color: T.red });
    }
    setBusy(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  if (!isConnected) {
    return <div style={{ padding: 20, fontFamily: "'VT323', monospace", background: T.bg, color: T.text, height: '100%' }}>Connect wallet to access Dev Camp.</div>;
  }

  const availableDevs = myDevs.filter(d => d.status === 'active' && !d.training_course);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg, color: T.text, fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '8px 12px', borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontWeight: 'bold', fontSize: 'var(--text-xl)', color: T.cyan }}>{'>'} DEV CAMP</div>
        <div style={{ fontSize: 'var(--text-sm)', color: T.textDim, marginTop: 2 }}>Train your devs. Permanently boost stats. Unlock harder missions.</div>
      </div>

      {/* Tabs */}
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: `1px solid ${T.cardBorder}` }}>
        {[['catalog', 'Catalog'], ['training', `In Training${trainingDevs.length ? ` (${trainingDevs.length})` : ''}`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontSize: 'var(--text-base)', padding: '5px 14px', fontWeight: tab === k ? 'bold' : 'normal',
            color: tab === k ? T.cyan : T.textMuted, background: 'transparent', border: 'none',
            borderBottom: tab === k ? `2px solid ${T.cyan}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: "'VT323', monospace",
          }}>{label}</button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ flexShrink: 0, fontSize: 'var(--text-base)', fontWeight: 'bold', padding: '6px 12px', margin: '4px 10px 0', border: `1px solid ${feedback.color}`, background: `${feedback.color}15`, color: feedback.color }}>{feedback.text}</div>
      )}

      {/* Scrollable content */}
      <div className="mc-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'scroll', padding: '8px 12px' }}>
        {tab === 'catalog' && (
          <>
            {/* Dev selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'var(--text-sm)', color: T.textMuted, marginBottom: 4 }}>SELECT DEV TO ENROLL:</div>
              <select value={selectedDev} onChange={e => setSelectedDev(e.target.value)} style={{
                fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)', background: T.card, color: T.green,
                border: `1px solid ${T.cardBorder}`, padding: '5px 8px', width: '100%',
              }}>
                <option value="">-- Choose a dev --</option>
                {myDevs.map(d => {
                  const onMission = d.status === 'on_mission';
                  const inTraining = !!d.training_course;
                  const ok = !onMission && !inTraining;
                  return (
                    <option key={d.token_id} value={d.token_id} disabled={!ok}>
                      {d.name} [{d.archetype}] HAK:{d.stat_hacking||'?'} COD:{d.stat_coding||'?'} TRD:{d.stat_trading||'?'} SOC:{d.stat_social||'?'} END:{d.stat_endurance||'?'}
                      {onMission ? ' (ON MISSION)' : ''}{inTraining ? ' (TRAINING)' : ''}
                    </option>
                  );
                })}
              </select>
              {myDevs.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: T.red, marginTop: 4 }}>No devs found. Mint a dev first.</div>}
              {myDevs.length > 0 && availableDevs.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: '#ff9800', marginTop: 4 }}>All devs are on missions or training.</div>}
            </div>

            {/* Classes */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 'var(--text-base)', color: '#ffaa00', fontWeight: 'bold', marginBottom: 4, borderBottom: `1px solid ${T.cardBorder}`, paddingBottom: 3 }}>
                🎓 CLASSES — 8h, +4 stat, 15 $NXT
              </div>
              {catalog.classes.map(it => (
                <TrainingRow key={it.id} item={it} disabled={!selectedDev || busy} onBuy={() => handleBuy(it.id, it.cost)} />
              ))}
            </div>

            {/* Courses */}
            <div>
              <div style={{ fontSize: 'var(--text-base)', color: '#ff6644', fontWeight: 'bold', marginBottom: 4, borderBottom: `1px solid ${T.cardBorder}`, paddingBottom: 3 }}>
                ⚡ INTENSIVE — 2h, +2 stat, 40 $NXT
              </div>
              {catalog.courses.map(it => (
                <TrainingRow key={it.id} item={it} disabled={!selectedDev || busy} onBuy={() => handleBuy(it.id, it.cost)} />
              ))}
            </div>
          </>
        )}

        {tab === 'training' && (
          trainingDevs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textDim }}>
              <div style={{ fontSize: 'var(--text-lg)', marginBottom: 8 }}>No devs in training</div>
              <div style={{ fontSize: 'var(--text-base)' }}>Go to Catalog to enroll a dev.</div>
            </div>
          ) : trainingDevs.map(d => (
            <div key={d.token_id} style={{ padding: '10px 12px', marginBottom: 6, background: T.card, border: `1px solid ${d.can_graduate ? T.green + '60' : T.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {d.ipfs_hash && <img src={`${IPFS_GW}${d.ipfs_hash}`} alt="" style={{ width: 36, height: 36, imageRendering: 'pixelated' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-base)', color: T.text, fontWeight: 'bold' }}>{d.name} <span style={{ color: T.textDim, fontWeight: 'normal' }}>[{d.archetype}]</span></div>
                  <div style={{ fontSize: 'var(--text-sm)', color: T.textMuted }}>{d.training_name} — +{d.boost} {d.stat?.toUpperCase()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.progress}%`, background: d.can_graduate ? T.green : '#ffaa00', transition: 'width 1s' }} />
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: d.can_graduate ? T.green : T.textDim, minWidth: 30 }}>{d.progress}%</span>
              </div>
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                {d.can_graduate ? (
                  <button className="win-btn" onClick={() => handleGraduate(d.token_id)} disabled={busy} style={{
                    fontSize: 'var(--text-base)', padding: '5px 14px', fontWeight: 'bold',
                    background: '#00332a', color: T.green, border: `1px solid ${T.green}`, cursor: 'pointer',
                    fontFamily: "'VT323', monospace",
                  }}>🎓 GRADUATE +{d.boost} {d.stat?.toUpperCase()}</button>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: T.textDim }}>
                    {Math.floor(d.remaining_seconds / 3600)}h {Math.floor((d.remaining_seconds % 3600) / 60)}m remaining
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrainingRow({ item, disabled, onBuy }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 10px', marginBottom: 3, background: 'rgba(255,255,255,0.02)',
      border: '1px solid #222',
    }}>
      <div>
        <div style={{ fontSize: 'var(--text-base)', color: '#e0e0e0' }}>{item.name}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {item.duration_hours}h — +{item.boost} {item.stat?.toUpperCase()} — {item.cost} $NXT
        </div>
      </div>
      <button className="win-btn" disabled={disabled} onClick={onBuy} style={{
        fontSize: 'var(--text-sm)', padding: '4px 12px', fontFamily: "'VT323', monospace",
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
      }}>ENROLL</button>
    </div>
  );
}
