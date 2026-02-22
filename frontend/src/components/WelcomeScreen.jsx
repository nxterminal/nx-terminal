import { useState, useEffect } from 'react';

export default function WelcomeScreen({ onComplete }) {
  const [phase, setPhase] = useState('welcome'); // welcome -> loading -> done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 1500);
    const t2 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  const wp = localStorage.getItem('nx-wallpaper') || 'teal';
  let bgStyle;
  switch (wp) {
    case 'corporate-blue':
      bgStyle = { background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)' };
      break;
    case 'matrix':
    case 'terminal':
      bgStyle = { background: '#000000' };
      break;
    case 'clouds':
      bgStyle = { background: 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 40%, #b0d4f1 60%, #ffffff 100%)' };
      break;
    default:
      bgStyle = { background: '#008080' };
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      ...bgStyle,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
    }}>
      <div style={{
        color: '#ffffff',
        fontFamily: "'VT323', monospace",
        textAlign: 'center',
        textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px', letterSpacing: '2px' }}>
          Welcome
        </div>
        <div style={{ fontSize: '18px', color: '#d0d0d0', marginBottom: '32px' }}>
          NX Terminal Corp. — Protocol Wars Division
        </div>

        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '14px', color: '#b0b0b0' }}>
              Loading your personal settings...
            </div>
            <div style={{
              width: '200px',
              height: '12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.3)',
              overflow: 'hidden',
            }}>
              <div className="welcome-progress-bar" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
