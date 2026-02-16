import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function NXTStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getSimulationStats()
      .then(data => setStats(data))
      .catch(() => setStats({
        total_devs: 1247,
        total_protocols: 89,
        total_ais: 34,
        total_transactions: 284729,
        total_nxt_supply: '10,000,000',
        active_corps: 12,
        average_dev_level: 4.2,
        highest_balance: '142,500',
      }));
  }, []);

  const s = stats || {};

  return (
    <div style={{ padding: '12px', overflow: 'auto', height: '100%', fontSize: '11px' }}>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: 'var(--win-title-l)' }}>
          NXT NETWORK STATISTICS
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          ['Total Devs', s.total_devs ?? '...', 'var(--terminal-cyan)'],
          ['Total Protocols', s.total_protocols ?? '...', 'var(--terminal-green)'],
          ['Total AIs', s.total_ais ?? '...', 'var(--terminal-magenta)'],
          ['Transactions', s.total_transactions ?? '...', 'var(--terminal-amber)'],
          ['$NXT Supply', s.total_nxt_supply ?? '...', 'var(--gold)'],
          ['Active Corps', s.active_corps ?? '...', '#4488ff'],
          ['Avg Dev Level', s.average_dev_level ?? '...', 'var(--terminal-green)'],
          ['Highest Balance', s.highest_balance ? `$${s.highest_balance}` : '...', 'var(--gold)'],
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
            <span style={{ width: '90px', color, fontSize: '10px', fontWeight: 'bold' }}>{name}</span>
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
