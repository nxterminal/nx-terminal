import { MOCK_LEADERBOARD } from '../constants';

function getRankClass(rank) {
  if (rank === 1) return 'phares-rank-gold';
  if (rank === 2) return 'phares-rank-silver';
  if (rank === 3) return 'phares-rank-bronze';
  return '';
}

function getWinRateClass(rate) {
  if (rate >= 60) return 'phares-winrate-positive';
  if (rate < 40) return 'phares-winrate-negative';
  return 'phares-winrate-neutral';
}

export default function LeaderboardTab() {
  return (
    <>
      <div className="phares-toolbar">
        <span className="phares-toolbar-title">Top Predictors</span>
      </div>
      <table className="phares-leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Address</th>
            <th>Markets</th>
            <th>Win Rate</th>
            <th>Total Wagered</th>
            <th>Net PNL</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_LEADERBOARD.map(entry => (
            <tr key={entry.rank}>
              <td className={getRankClass(entry.rank)}>#{entry.rank}</td>
              <td>{entry.address}</td>
              <td>{entry.markets}</td>
              <td className={getWinRateClass(entry.winRate)}>{entry.winRate}%</td>
              <td>{entry.wagered}</td>
              <td style={{ color: entry.pnl.startsWith('+') ? 'var(--accent)' : 'var(--negative)', fontWeight: 600 }}>
                {entry.pnl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
