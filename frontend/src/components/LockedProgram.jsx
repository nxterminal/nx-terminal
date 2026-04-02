import { PROGRAM_MIN_DEVS, getTier, TIERS } from '../config/tiers';

export default function LockedProgram({ programId, programName, devCount, openWindow, onClose }) {
  const requiredDevs = PROGRAM_MIN_DEVS[programId] || 0;
  const requiredTier = TIERS.find(t => t.minDevs === requiredDevs) || TIERS[0];
  const currentTier = getTier(devCount);
  const devsNeeded = requiredDevs - devCount;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '24px', gap: '12px',
      fontFamily: "'VT323', monospace", textAlign: 'center',
      background: 'var(--terminal-bg, #111)',
    }}>
      <div style={{ fontSize: '40px' }}>&#x1F512;</div>

      <div style={{
        fontSize: '18px', fontWeight: 'bold',
        color: 'var(--terminal-amber, #ffaa00)',
      }}>
        ACCESS RESTRICTED
      </div>

      <div style={{
        fontSize: '14px', color: 'var(--text-primary, #ccc)',
        padding: '8px 16px',
        border: '1px solid var(--border-dark, #444)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: 'var(--terminal-cyan, #00ffff)' }}>{programName || programId}</span> requires:
        </div>
        <div style={{ fontSize: '16px', color: 'var(--gold, #ffd700)', fontWeight: 'bold' }}>
          {requiredTier.icon} {requiredTier.label} ({requiredDevs} devs)
        </div>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)' }}>
        Your rank: <span style={{ color: 'var(--terminal-green, #33ff33)', fontWeight: 'bold' }}>
          {currentTier.icon} {currentTier.label} ({devCount} devs)
        </span>
      </div>

      <div style={{
        fontSize: '14px', color: 'var(--terminal-amber, #ffaa00)',
        fontWeight: 'bold',
      }}>
        Mint {devsNeeded} more dev{devsNeeded !== 1 ? 's' : ''} to unlock!
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          className="win-btn"
          onClick={() => openWindow?.('hire-devs')}
          style={{ padding: '4px 16px', fontWeight: 'bold', fontSize: '12px' }}
        >
          Mint Devs
        </button>
        <button
          className="win-btn"
          onClick={onClose}
          style={{ padding: '4px 16px', fontSize: '12px' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
