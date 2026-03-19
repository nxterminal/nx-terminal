import { MOCK_LEADERBOARD } from '../constants';

const RANK_COLORS = {
  1: 'var(--amber)',
  2: '#8a939e',
  3: 'var(--orange)',
};

export default function LeaderboardPanel() {
  const top5 = MOCK_LEADERBOARD.slice(0, 5);

  return (
    <div className="phares-panel">
      <div className="phares-panel-label">Top Predictors</div>
      {top5.map(entry => (
        <div key={entry.rank} className="phares-lb-row">
          <span className="phares-lb-rank" style={{ color: RANK_COLORS[entry.rank] || 'var(--text-muted)' }}>
            #{entry.rank}
          </span>
          <span className="phares-lb-address">{entry.address}</span>
          <span className={`phares-lb-pnl ${entry.pnl.startsWith('-') ? 'phares-lb-pnl--negative' : ''}`}>
            {entry.pnl}
          </span>
        </div>
      ))}
    </div>
  );
}
