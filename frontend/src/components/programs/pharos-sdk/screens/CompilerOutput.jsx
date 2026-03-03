import { CORPORATIONS } from '../data/constants';

export default function CompilerOutput({ mission, passed, details, onContinue, onRetry }) {
  const corp = CORPORATIONS[mission.corp];

  if (passed) {
    return (
      <div className="ps-result-screen">
        <div className="ps-result-icon success">{'\u2713'}</div>
        <div className="ps-result-title" style={{ color: '#00ff41' }}>
          {'\u2550'.repeat(3)} MISSION COMPLETE {'\u2550'.repeat(3)}
        </div>
        <div className="ps-result-xp">
          +{mission.xp} XP {'\u2014'}{' '}
          <span style={{ color: corp.color }}>{corp.name}</span>
        </div>
        <div className="ps-result-message">{mission.completionMessage}</div>
        <button className="ps-result-btn success" onClick={onContinue}>
          {'\u25B6'} CONTINUE
        </button>
      </div>
    );
  }

  return (
    <div className="ps-result-screen">
      <div className="ps-result-icon fail">{'\u2717'}</div>
      <div className="ps-result-title" style={{ color: '#ff3333' }}>
        {'\u2550'.repeat(3)} MISSION FAILED {'\u2550'.repeat(3)}
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
      <button className="ps-result-btn fail" onClick={onRetry}>
        {'\u25B6'} RETRY
      </button>
    </div>
  );
}
