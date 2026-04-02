import { PROGRAM_MIN_DEVS, getTier, TIERS } from '../config/tiers';

const PROGRAM_DESCRIPTIONS = {
  'world-chat': 'Global chat room where players discuss strategies and coordinate with other dev teams.',
  'leaderboard': 'Rankings of the top developers and corporations in the Protocol Wars.',
  'dev-academy': 'Training platform to learn blockchain development and MegaETH fundamentals.',
  'protocol-market': 'Marketplace to browse, invest, and trade protocols created by devs.',
  'ai-lab': 'Laboratory where your devs create and vote on absurd AI experiments.',
  'corp-wars': 'Corporate territory battles — see which corporation dominates each sector.',
  'monad-city': 'Isometric 3D city visualization with live MegaETH blockchain data.',
  'monad-build': 'Smart contract IDE with templates, compilation tools, and deploy guides for MegaETH.',
  'netwatch': 'Real-time MegaETH network surveillance — blocks, transactions, gas, TPS.',
  'flow': 'Advanced wallet analytics and token flow visualization.',
  'nadwatch': 'Deep network analysis dashboard.',
  'parallax': 'Experimental data visualization tool.',
};

export default function LockedProgram({ programId, programName, devCount, openWindow, onClose }) {
  const requiredDevs = PROGRAM_MIN_DEVS[programId] || 0;
  const requiredTier = TIERS.find(t => t.minDevs === requiredDevs) || TIERS[0];
  const currentTier = getTier(devCount);
  const devsNeeded = requiredDevs - devCount;
  const description = PROGRAM_DESCRIPTIONS[programId] || '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '24px', gap: '10px',
      fontFamily: "'VT323', monospace", textAlign: 'center',
      background: 'var(--terminal-bg, #111)',
    }}>
      <div style={{ fontSize: '36px' }}>&#x1F512;</div>

      <div style={{
        fontSize: '18px', fontWeight: 'bold',
        color: 'var(--terminal-amber, #ffaa00)',
      }}>
        ACCESS RESTRICTED
      </div>

      {/* Program name + description */}
      <div style={{
        padding: '10px 16px', maxWidth: '340px',
        border: '1px solid var(--border-dark, #444)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontSize: '16px', fontWeight: 'bold',
          color: 'var(--terminal-cyan, #00ffff)',
          textTransform: 'uppercase', marginBottom: '6px',
        }}>
          {programName || programId}
        </div>
        {description && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #999)', lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>

      {/* Requirements */}
      <div style={{
        fontSize: '14px', color: 'var(--text-primary, #ccc)',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        <div>
          Requires: <span style={{ color: 'var(--gold, #ffd700)', fontWeight: 'bold' }}>
            {requiredTier.icon} {requiredTier.label} ({requiredDevs} devs)
          </span>
        </div>
        <div>
          Your rank: <span style={{ color: 'var(--terminal-green, #33ff33)', fontWeight: 'bold' }}>
            {currentTier.icon} {currentTier.label} ({devCount} dev{devCount !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      <div style={{
        fontSize: '15px', color: 'var(--terminal-amber, #ffaa00)',
        fontWeight: 'bold', marginTop: '4px',
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
