import { PROGRAM_MIN_DEVS, getTier, TIERS } from '../config/tiers';

const PROGRAM_DESCRIPTIONS = {
  'world-chat': 'Global chat room where players discuss strategies, form alliances, and coordinate dev teams across corporations. See what others are building in real time.',
  'leaderboard': 'Rankings of the top developers and corporations in the Protocol Wars. Track who earns the most $NXT, ships the most code, and dominates each sector.',
  'dev-academy': 'Interactive training platform with hands-on lessons in blockchain development, smart contracts, and MegaETH fundamentals. Earn XP as you learn.',
  'protocol-market': 'Marketplace to browse, invest in, and trade protocols created by devs. Watch protocol values rise and fall based on code quality and community votes.',
  'ai-lab': 'Laboratory where your devs create and vote on absurd AI experiments. Generate wild AI concepts and see which ones the community loves or hates.',
  'corp-wars': 'Corporate territory battles — watch corporations compete for dominance across sectors. Your devs\' actions contribute to your corp\'s score and ranking.',
  'monad-city': 'Isometric 3D city visualization powered by live MegaETH blockchain data. Watch blocks get built, transactions flow through streets, and gas prices light up the skyline.',
  'monad-build': 'Full smart contract IDE with templates, Solidity compilation, deployment guides, and live testing tools for MegaETH. Build and deploy directly from the terminal.',
  'netwatch': 'Real-time MegaETH network surveillance dashboard — monitor blocks, transactions, gas prices, TPS, and network health with live-updating charts and alerts.',
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
        fontSize: 'var(--text-xl)', fontWeight: 'bold',
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
          fontSize: 'var(--text-lg)', fontWeight: 'bold',
          color: 'var(--terminal-cyan, #00ffff)',
          textTransform: 'uppercase', marginBottom: '6px',
        }}>
          {programName || programId}
        </div>
        {description && (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted, #999)', lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>

      {/* Requirements */}
      <div style={{
        fontSize: 'var(--text-base)', color: 'var(--text-primary, #ccc)',
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
        fontSize: 'var(--text-lg)', color: 'var(--terminal-amber, #ffaa00)',
        fontWeight: 'bold', marginTop: '4px',
      }}>
        Mint {devsNeeded} more dev{devsNeeded !== 1 ? 's' : ''} to unlock!
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          className="win-btn"
          onClick={() => openWindow?.('hire-devs')}
          style={{ padding: '4px 16px', fontWeight: 'bold', fontSize: 'var(--text-sm)' }}
        >
          Mint Devs
        </button>
        <button
          className="win-btn"
          onClick={onClose}
          style={{ padding: '4px 16px', fontSize: 'var(--text-sm)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
