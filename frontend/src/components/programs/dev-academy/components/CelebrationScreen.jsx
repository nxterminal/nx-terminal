import { useState, useEffect } from 'react';
import { CORPS } from '../data/corps';

export default function CelebrationScreen({ type, data, onContinue }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const isPath = type === 'path';
  const corp = data?.corp ? CORPS[data.corp] : null;

  return (
    <div style={{
      padding: '60px 24px', textAlign: 'center',
      opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(20px)',
      transition: 'all 0.6s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Celebration icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 20, margin: '0 auto 20px',
          background: isPath
            ? 'linear-gradient(135deg, #10b981, #06b6d4)'
            : `linear-gradient(135deg, ${corp?.color || '#10b981'}, ${corp?.color || '#10b981'}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 40px ${isPath ? '#10b98130' : (corp?.color || '#10b981') + '30'}`,
        }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
            {isPath ? 'OK' : (corp?.icon || 'M')}
          </span>
        </div>

        <h2 style={{
          color: '#f1f5f9', fontSize: isPath ? 28 : 24, fontWeight: 800, margin: '0 0 8px',
          fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em',
        }}>
          {isPath ? 'Path Complete!' : 'Module Complete!'}
        </h2>

        <p style={{ color: '#94a3b8', fontSize: 15, margin: '0 0 24px', lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
          {isPath
            ? `You finished the ${data?.pathName || 'learning path'}. Every lesson conquered.`
            : `You completed "${data?.moduleName || 'this module'}". Great progress!`
          }
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 32 }}>
          <div>
            <div style={{ color: '#eab308', fontSize: 28, fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>+{data?.xpEarned || 0}</div>
            <div style={{ color: '#64748b', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>XP Earned</div>
          </div>
          <div style={{ width: 1, background: '#1e293b' }} />
          <div>
            <div style={{ color: '#10b981', fontSize: 28, fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>{data?.lessonsCompleted || 0}</div>
            <div style={{ color: '#64748b', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>Lessons</div>
          </div>
        </div>

        {/* Corp badge for module completion */}
        {!isPath && corp && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: corp.color + '10', border: `1px solid ${corp.color}25`,
            borderRadius: 10, padding: '8px 16px', marginBottom: 24,
          }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: corp.color + '20', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: corp.color, fontFamily: 'monospace' }}>{corp.icon}</span>
            <span style={{ color: corp.color, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>Endorsed by {corp.name}</span>
          </div>
        )}

        <div>
          <button onClick={onContinue} style={{
            background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
            borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif', boxShadow: '0 4px 16px #10b98130',
          }}>
            {isPath ? 'Back to Paths' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
