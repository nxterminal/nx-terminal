import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { api } from '../services/api';

function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DailyStreakPopup() {
  const { address, isConnected } = useWallet();
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const checked = useRef(false);

  // Initial fetch: get streak status, gate by hasDev
  useEffect(() => {
    if (!isConnected || !address || checked.current || dismissed) return;
    checked.current = true;
    api.getStreak(address)
      .then(d => {
        // Verify player actually has devs before showing popup
        return api.getDevs({ owner: address, limit: 1 }).then(devs => {
          const hasDev = Array.isArray(devs) ? devs.length > 0 : (devs?.devs?.length > 0);
          if (!hasDev) return;
          setData(d);
          if (!d.can_claim && d.seconds_until_next_claim > 0) {
            setSecondsRemaining(d.seconds_until_next_claim);
          }
        });
      })
      .catch(() => {});
  }, [isConnected, address, dismissed]);

  // Countdown ticker: decrement every second when in cooldown
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          // Cooldown ended → refetch to enable claim
          api.getStreak(address)
            .then(d => {
              setData(d);
              if (d.can_claim) setResult(null);
            })
            .catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining, address]);

  async function handleClaim() {
    if (!address) return;
    setClaiming(true);
    try {
      const res = await api.claimStreak(address);
      setResult(res);
      // After successful claim, set cooldown for next 24h
      if (res.seconds_until_next_claim) {
        setSecondsRemaining(res.seconds_until_next_claim);
      }
    } catch (err) {
      // Race condition: backend says cooldown active
      if (err.detail?.seconds_until_next_claim) {
        setSecondsRemaining(err.detail.seconds_until_next_claim);
        setData(prev => prev ? { ...prev, can_claim: false } : prev);
        setResult(null);
      } else {
        setResult({ error: err.message || 'Claim failed' });
      }
    } finally {
      setClaiming(false);
    }
  }

  if (!data || dismissed) return null;

  const cycleLength = (result?.cycle_length ?? data.cycle_length ?? 7);
  const absoluteDay = result ? result.streak : (data.next_day ?? data.current_streak ?? 1);
  const dayInCycle = (
    result?.day_in_cycle ??
    data.day_in_cycle ??
    Math.max(1, ((absoluteDay - 1) % cycleLength) + 1)
  );
  const day = dayInCycle;

  const isCooldown = !data.can_claim && !result && secondsRemaining > 0;
  const isClaimable = data.can_claim && !result;
  const isResult = !!result;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 10500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
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
          {isClaimable && (
            <>
              <div style={{ fontSize: 14, color: '#cfcfcf', marginBottom: 12 }}>
                DAILY ATTENDANCE — DAY {dayInCycle} OF {cycleLength}
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
          )}

          {isCooldown && (
            <>
              <div style={{ fontSize: 14, color: '#cfcfcf', marginBottom: 12 }}>
                COOLDOWN ACTIVE — DAY {dayInCycle} OF {cycleLength}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {Array.from({ length: Math.min(day, 7) }, (_, i) => (
                  <div key={i} style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: i < day ? '#2d8a2d' : '#1a1a2e',
                    border: '2px solid #333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: i < day ? '#66ff66' : '#555',
                  }}>{i + 1}</div>
                ))}
              </div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>
                NEXT CLAIM IN
              </div>
              <div style={{
                color: '#66ff66', fontSize: 36, marginBottom: 12,
                fontFamily: "'VT323', monospace", letterSpacing: 2,
                textShadow: '0 0 8px rgba(102,255,102,0.4)',
              }}>
                {formatCountdown(secondsRemaining)}
              </div>
              <div style={{ color: '#cfcfcf', fontSize: 12, marginBottom: 16 }}>
                Streak: {data.current_streak} days | Record: {data.longest_streak}
              </div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>
                Next reward: <span style={{ color: '#ffdd44' }}>+{data.next_reward} $NXT</span>
              </div>
              <button onClick={() => setDismissed(true)} style={{
                width: '100%', padding: 8, fontSize: 14,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#333', color: '#cfcfcf', border: '1px solid #555',
              }}>CLOSE</button>
            </>
          )}

          {isResult && result.error && (
            <>
              <div style={{ color: '#ff4444', fontSize: 16, marginBottom: 12 }}>{result.error}</div>
              <button onClick={() => setDismissed(true)} style={{
                width: '100%', padding: 8, fontSize: 14,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#333', color: '#cfcfcf', border: '1px solid #555',
              }}>OK</button>
            </>
          )}

          {isResult && !result.error && (
            <>
              <div style={{ color: '#66ff66', fontSize: 18, marginBottom: 8 }}>
                ATTENDANCE LOGGED
              </div>
              <div style={{ color: '#ffdd44', fontSize: 28, marginBottom: 8 }}>
                +{result.reward} $NXT
              </div>
              <div style={{ color: '#cfcfcf', fontSize: 13, marginBottom: 4 }}>
                Day {dayInCycle} of {cycleLength} · streak {result.streak} — {result.dev_name}
              </div>
              {secondsRemaining > 0 && (
                <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                  Next claim in <span style={{ color: '#66ff66' }}>{formatCountdown(secondsRemaining)}</span>
                </div>
              )}
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

          {!isClaimable && !isCooldown && !isResult && (
            <>
              <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
                Loading streak status...
              </div>
              <button onClick={() => setDismissed(true)} style={{
                width: '100%', padding: 8, fontSize: 14,
                fontFamily: "'VT323', monospace", cursor: 'pointer',
                background: '#333', color: '#cfcfcf', border: '1px solid #555',
              }}>CLOSE</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
