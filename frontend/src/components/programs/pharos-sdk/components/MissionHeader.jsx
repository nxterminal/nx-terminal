import { CORPORATIONS, DIFFICULTIES, EXERCISE_TYPES } from '../data/constants';

const TYPE_LABELS = {
  [EXERCISE_TYPES.QUIZ]: "KNOWLEDGE QUIZ",
  [EXERCISE_TYPES.CODE]: "CODE EXERCISE",
  [EXERCISE_TYPES.BUG_HUNT]: "BUG HUNT",
};

export default function MissionHeader({ mission, onBack }) {
  const corp = CORPORATIONS[mission.corp];
  const diff = DIFFICULTIES[mission.difficulty];
  const typeLabel = TYPE_LABELS[mission.type] || "EXERCISE";

  return (
    <div className="ps-mission-header">
      <div className="ps-mission-header-top">
        <div>
          <span style={{ color: '#888' }}>
            MISSION #{String(mission.number).padStart(2, '0')} {'\u2014'} {typeLabel}
          </span>
        </div>
        <button className="ps-back-btn" onClick={onBack}>{'\u25C0'} BACK</button>
      </div>
      <div className="ps-mission-title">{mission.title}</div>
      <div className="ps-mission-corp-line">
        <span style={{ color: corp.color }}>{corp.icon} {corp.name}</span>
        <span style={{ color: '#666' }}> {'\u2014'} "{corp.motto}"</span>
      </div>
      <div className="ps-mission-diff">
        <span style={{ color: '#888' }}>DIFF: </span>
        <span style={{ color: diff.color }}>
          {'\u2588'.repeat(diff.bars)}{'\u2591'.repeat(4 - diff.bars)}
        </span>
      </div>
    </div>
  );
}
