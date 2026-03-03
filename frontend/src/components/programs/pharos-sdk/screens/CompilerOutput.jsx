import { CORPORATIONS, RANKS } from '../data/constants';

export default function CompilerOutput({ mission, passed, details, xp, prevXp }) {
  const corp = CORPORATIONS[mission.corp];

  // Check for rank up
  const prevRank = [...RANKS].reverse().find(r => (prevXp || 0) >= r.xpRequired) || RANKS[0];
  const newRank = [...RANKS].reverse().find(r => xp >= r.xpRequired) || RANKS[0];
  const didRankUp = passed && newRank.name !== prevRank.name;

  if (passed) {
    return (
      <div className="ps-result-screen">
        <div className="ps-result-badge">
          <div className="ps-result-badge-icon success">{'\u2713'}</div>
          <div className="ps-result-badge-title">MISSION COMPLETE</div>
          <div className="ps-result-badge-xp">+{mission.xp} XP</div>
          <div className="ps-result-badge-corp" style={{ color: corp.color }}>
            {corp.icon} {corp.name}
          </div>
        </div>

        <div className="ps-result-message-panel">{mission.completionMessage}</div>

        {didRankUp && (
          <div className="ps-result-rank-up">
            NEW RANK UNLOCKED:{' '}
            <span style={{ color: newRank.color }}>{newRank.name}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ps-result-screen">
      <div className="ps-result-badge">
        <div className="ps-result-badge-icon fail">{'\u2717'}</div>
        <div className="ps-result-badge-title">COMPILATION FAILED</div>
      </div>

      <div className="ps-result-details">
        {details.correctCount !== undefined ? (
          <span>
            {details.correctCount}/{details.totalQuestions} correct. Minimum required: {Math.ceil(details.totalQuestions * 0.66)}.
          </span>
        ) : details.wrongLines ? (
          <span>
            Errors found on line{details.wrongLines.length > 1 ? 's' : ''}: {details.wrongLines.join(', ')}
          </span>
        ) : null}
      </div>
      <div className="ps-result-retry-msg">Fix your answers and try again.</div>
    </div>
  );
}
