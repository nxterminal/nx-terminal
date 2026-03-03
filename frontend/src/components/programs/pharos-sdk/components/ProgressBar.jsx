import { RANKS } from '../data/constants';

export default function ProgressBar({ xp, completedCount, totalCount }) {
  const currentRank = [...RANKS].reverse().find(r => xp >= r.xpRequired) || RANKS[0];
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];
  const xpForNext = nextRank ? nextRank.xpRequired : currentRank.xpRequired;
  const xpInRank = xp - currentRank.xpRequired;
  const xpNeeded = nextRank ? xpForNext - currentRank.xpRequired : 1;
  const pct = nextRank ? Math.min(xpInRank / xpNeeded, 1) : 1;
  const barWidth = 20;
  const filled = Math.round(pct * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  return (
    <div className="ps-progress-bar">
      <span>RANK: </span>
      <span className="ps-rank" style={{ color: currentRank.color }}>{currentRank.name}</span>
      <span className="ps-progress-sep">{' | '}</span>
      <span>XP: </span>
      <span style={{ color: '#ffff00' }}>{bar}</span>
      <span>{' '}{xp}/{xpForNext}</span>
      <span className="ps-progress-sep">{' | '}</span>
      <span>MISSIONS: {completedCount}/{totalCount}</span>
    </div>
  );
}
