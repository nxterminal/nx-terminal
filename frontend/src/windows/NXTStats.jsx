import { useDevs } from '../contexts/DevsContext';

export default function NXTStats() {
  const { devs, totalSalary } = useDevs();

  const archetypeCounts = {};
  devs.forEach(d => {
    archetypeCounts[d.archetype] = (archetypeCounts[d.archetype] || 0) + 1;
  });

  const avgEnergy = devs.length > 0
    ? Math.round(devs.reduce((sum, d) => sum + (d.energy || 0), 0) / devs.length)
    : 0;

  const totalBalance = devs.reduce((sum, d) => sum + (d.balance_nxt || 0), 0);

  return (
    <div style={{ padding: '12px', overflow: 'auto', height: '100%', fontSize: '11px' }}>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: 'var(--win-title-l)' }}>
          NXT NETWORK STATISTICS
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          ['Your Devs', devs.length, 'var(--terminal-cyan)'],
          ['Avg Energy', `${avgEnergy}%`, 'var(--terminal-green)'],
          ['Total Balance', `${totalBalance.toLocaleString()} $NXT`, 'var(--gold)'],
          ['Cycle Salary', `${totalSalary + 1000} $NXT`, 'var(--terminal-amber)'],
          ['Network Devs', '1,247', 'var(--terminal-cyan)'],
          ['Active Protocols', '89', 'var(--terminal-green)'],
          ['Total AIs', '34', 'var(--terminal-magenta)'],
          ['Transactions', '284,729', 'var(--terminal-amber)'],
        ].map(([label, value, color]) => (
          <div key={label} className="win-panel stat-box">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="win-panel" style={{ padding: '12px', marginTop: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--border-dark)', paddingBottom: '4px' }}>
          Archetype Distribution
        </div>
        {[
          ['10X_DEV', 15, '#ff4444'], ['GRINDER', 25, '#4488ff'], ['DEGEN', 20, '#ffd700'],
          ['LURKER', 12, '#808080'], ['INFLUENCER', 10, '#ff44ff'], ['HACKTIVIST', 8, '#33ff33'],
          ['FED', 5, '#ffaa00'], ['SCRIPT_KIDDIE', 5, '#00ffff'],
        ].map(([name, pct, color]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: '90px', color, fontSize: '10px', fontWeight: 'bold' }}>
              {name} {archetypeCounts[name] ? `(${archetypeCounts[name]})` : ''}
            </span>
            <div style={{ flex: 1, height: '10px', background: '#000', border: '1px solid var(--border-dark)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color }} />
            </div>
            <span style={{ width: '30px', textAlign: 'right', fontSize: '10px' }}>{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
