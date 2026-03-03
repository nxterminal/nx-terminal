import { CORPORATIONS, DIFFICULTIES, EXERCISE_TYPES } from '../data/constants';

const TYPE_LABELS = {
  [EXERCISE_TYPES.QUIZ]: "KNOWLEDGE QUIZ",
  [EXERCISE_TYPES.CODE]: "CODE EXERCISE",
  [EXERCISE_TYPES.BUG_HUNT]: "BUG HUNT",
};

export default function MissionHeader({ mission }) {
  const corp = CORPORATIONS[mission.corp];
  const diff = DIFFICULTIES[mission.difficulty];
  const typeLabel = TYPE_LABELS[mission.type] || "EXERCISE";

  return (
    <div className="ps-mission-header">
      <div className="ps-mission-header-top">
        <span>
          MISSION #{String(mission.number).padStart(2, '0')} {'\u2014'} {typeLabel}
        </span>
      </div>
      <div className="ps-mission-title">{mission.title}</div>
      <div className="ps-mission-corp-line">
        <span style={{ color: corp.color }}>{corp.icon} {corp.name}</span>
        <span style={{ color: '#666', fontStyle: 'italic' }}> {'\u2014'} "{corp.motto}"</span>
      </div>
      <div className="ps-mission-diff">
        <span style={{ color: '#666' }}>DIFF: </span>
        <span style={{ color: diff.color }}>
          {'\u2588'.repeat(diff.bars)}{'\u2591'.repeat(4 - diff.bars)}
        </span>
      </div>
    </div>
  );
}
