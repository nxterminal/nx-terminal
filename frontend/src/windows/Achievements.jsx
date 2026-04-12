import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

const RARITY_COLORS = { common: '#aaaaaa', uncommon: '#44ff44', rare: '#4488ff', epic: '#cc66ff', legendary: '#ffdd44' };
const T = { bg: '#0f0f1a', card: '#1a1a2e', cardBorder: '#2a2a3e', text: '#e0e0e0', textMuted: '#888', textDim: '#666', cyan: '#00e5ff', gold: '#ffd700', green: '#00ff00', red: '#ff4444' };

export default function Achievements() {
  const { address, isConnected } = useWallet();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    api.getAchievements(address)
      .then(d => setAchievements(d.achievements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const handleClaim = async (id) => {
    try {
      const res = await api.claimAchievement(address, id);
      setFeedback({ text: `+${res.reward} $NXT — ${res.title}`, color: T.gold });
      setAchievements(prev => prev.map(a => a.id === id ? { ...a, claimed: true } : a));
      // Trigger floating gain animation
      window.dispatchEvent(new CustomEvent('nx-stat-animation', {
        detail: [{ stat: '$NXT', amount: res.reward, type: 'gain' }],
      }));
    } catch (e) {
      setFeedback({ text: e.message || 'Claim failed', color: T.red });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const unlocked = achievements.filter(a => a.unlocked).length;
  const categories = [...new Set(achievements.map(a => a.category))];

  if (!isConnected) {
    return (
      <div style={{ padding: 20, fontFamily: "'VT323', monospace", background: T.bg, color: T.text, height: '100%' }}>
        Connect wallet to view achievements.
      </div>
    );
  }

  return (
    <div className="mc-scroll" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      padding: '8px 10px', fontFamily: "'VT323', monospace", fontSize: 13,
      overflowY: 'scroll', background: T.bg, color: T.text,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 'bold', fontSize: 18, color: T.cyan }}>{'>'} ACHIEVEMENTS</div>
        <div style={{ fontSize: 13, color: T.textMuted }}>{unlocked}/{achievements.length} unlocked</div>
      </div>

      {feedback && (
        <div style={{
          fontSize: 13, fontWeight: 'bold', marginBottom: 8, padding: '6px 10px',
          border: `1px solid ${feedback.color}`, background: `${feedback.color}15`, color: feedback.color,
        }}>{feedback.text}</div>
      )}

      {loading && <div style={{ color: T.textMuted }}>Loading...</div>}

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 12, color: T.textDim, textTransform: 'uppercase', marginBottom: 4,
            borderBottom: `1px solid ${T.cardBorder}`, paddingBottom: 2,
          }}>{cat}</div>
          {achievements.filter(a => a.category === cat).map(a => {
            const rc = RARITY_COLORS[a.rarity] || '#aaa';
            const pct = a.requirement_value > 0
              ? Math.min(100, Math.round((a.progress || 0) / a.requirement_value * 100)) : 0;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4,
                background: a.unlocked ? 'rgba(100,255,100,0.04)' : T.card,
                border: `1px solid ${a.unlocked ? rc + '40' : T.cardBorder}`,
                opacity: a.unlocked ? 1 : 0.55,
              }}>
                <span style={{ fontSize: 22, filter: a.unlocked ? 'none' : 'grayscale(1)', flexShrink: 0 }}>
                  {a.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: a.unlocked ? '#fff' : '#666', fontWeight: 'bold' }}>
                    {a.title}{' '}
                    <span style={{ fontSize: 10, color: rc, fontWeight: 'normal', textTransform: 'uppercase' }}>
                      {a.rarity}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{a.description}</div>
                  {!a.unlocked && (
                    <div style={{ marginTop: 3 }}>
                      <div style={{
                        height: 6, background: '#111', borderRadius: 2, overflow: 'hidden',
                        width: '100%', maxWidth: 180,
                      }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: rc, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                        {a.progress || 0}/{a.requirement_value}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {a.unlocked && !a.claimed && (
                    <button className="win-btn" onClick={() => handleClaim(a.id)} style={{
                      fontSize: 12, padding: '4px 10px', fontWeight: 'bold',
                      background: '#00332a', color: T.green, border: `1px solid ${T.green}`,
                      cursor: 'pointer', fontFamily: "'VT323', monospace",
                    }}>+{a.reward_nxt}</button>
                  )}
                  {a.claimed && <span style={{ color: '#2d8a2d', fontSize: 12 }}>CLAIMED</span>}
                  {!a.unlocked && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>LOCKED</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
