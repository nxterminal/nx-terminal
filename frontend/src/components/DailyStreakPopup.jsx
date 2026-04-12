import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { api } from '../services/api';

export default function DailyStreakPopup() {
  const { address, isConnected } = useWallet();
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!isConnected || !address || checked.current || dismissed) return;
    checked.current = true;
    // Only show streak popup if player has devs (registered player)
    api.getStreak(address)
      .then(d => {
        if (!d.can_claim) return;
        // Verify player actually has devs before showing popup
        return api.getDevs({ owner: address, limit: 1 }).then(devs => {
          const hasDev = Array.isArray(devs) ? devs.length > 0 : (devs?.devs?.length > 0);
          if (hasDev) setData(d);
        });
      })
      .catch(() => {});
  }, [isConnected, address, dismissed]);

  async function handleClaim() {
    if (!address) return;
    setClaiming(true);
    try {
      const res = await api.claimStreak(address);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message || 'Claim failed' });
    } finally {
      setClaiming(false);
    }
  }

  if (!data || dismissed) return null;

  const day = result ? result.streak : data.next_day;
  const reward = result ? result.reward : data.next_reward;

  return (
    <div onClick={() => setDismissed(true)} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10500,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', border: '2px solid #3a5a3a',
        minWidth: 340, maxWidth: 420, fontFamily: "'VT323', monospace",
        boxShadow: 'inset -3px -3px 0 #0a0a1e, inset 3px 3px 0 #2a2a4e, 0 0 30px rgba(0,255,100,0.1)',
      }}>
        {/* Header */}
        <div style={{
          background: '#0a0a1e', padding: '8px 12px',
          borderBottom: '2px solid #3a5a3a',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#66ff66', fontSize: 14 }}>NX Terminal — Daily Check-in</span>
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: '1px solid #555', color: '#cfcfcf',
            cursor: 'pointer', padding: '2px 8px', fontFamily: "'VT323', monospace",
          }}>X</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, textAlign: 'center' }}>
          {!result ? (
            <>
              <div style={{ fontSize: 14, color: '#cfcfcf', marginBottom: 12 }}>
                DAILY ATTENDANCE — DAY {data.next_day}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {Array.from({ length: Math.min(day, 7) }, (_, i) => (
                  <div key={i} style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: i < day - 1 ? '#2d8a2d' : '#1a1a2e',
                    border: i === day - 1 ? '2px solid #66ff66' : '2px solid #333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: i < day ? '#66ff66' : '#555',
                    animation: i === day - 1 ? 'mission-pulse 2s infinite' : 'none',
                  }}>{i + 1}</div>
                ))}
              </div>
              <div style={{ color: '#ffdd44', fontSize: 28, marginBottom: 8 }}>
                +{data.next_reward} $NXT
              </div>
              <div style={{ color: '#cfcfcf', fontSize: 12, marginBottom: 16 }}>
                Streak: {data.current_streak} days | Record: {data.longest_streak}
              </div>
              <button onClick={handleClaim} disabled={claiming} style={{
                width: '100%', padding: '10px', fontSize: 16,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#2d8a2d', color: '#fff', border: '2px solid #44ff44',
                boxShadow: 'inset -2px -2px 0 #1a5a1a, inset 2px 2px 0 #4aaa4a',
              }}>
                {claiming ? 'PROCESSING...' : 'CLAIM ATTENDANCE BONUS'}
              </button>
            </>
          ) : result.error ? (
            <>
              <div style={{ color: '#ff4444', fontSize: 16, marginBottom: 12 }}>{result.error}</div>
              <button onClick={() => setDismissed(true)} style={{
                width: '100%', padding: 8, fontSize: 14,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#333', color: '#cfcfcf', border: '1px solid #555',
              }}>OK</button>
            </>
          ) : (
            <>
              <div style={{ color: '#66ff66', fontSize: 18, marginBottom: 8 }}>
                ATTENDANCE LOGGED
              </div>
              <div style={{ color: '#ffdd44', fontSize: 28, marginBottom: 8 }}>
                +{result.reward} $NXT
              </div>
              <div style={{ color: '#cfcfcf', fontSize: 13, marginBottom: 4 }}>
                Day {result.streak} streak — {result.dev_name}
              </div>
              <div style={{ color: '#cfcfcf', fontSize: 12, marginBottom: 16 }}>
                Check your inbox for confirmation.
              </div>
              <button onClick={() => setDismissed(true)} style={{
                width: '100%', padding: 8, fontSize: 14,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#333', color: '#ccc', border: '1px solid #555',
              }}>CONTINUE</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
