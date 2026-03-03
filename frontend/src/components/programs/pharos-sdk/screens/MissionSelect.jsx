import { CORPORATIONS, DIFFICULTIES } from '../data/constants';
import TRACK_1 from '../data/missions-track1';
import TRACK_2 from '../data/missions-track2';
import ProgressBar from '../components/ProgressBar';

export default function MissionSelect({ completedMissions, xp, onSelectMission }) {
  const totalMissions = TRACK_1.missions.length + TRACK_2.missions.length;

  const getMissionState = (mission, index, track) => {
    if (track.locked) return 'mint-locked';
    if (completedMissions.includes(mission.id)) return 'completed';
    // First mission is always available; otherwise previous must be completed
    if (index === 0) return 'available';
    if (completedMissions.includes(track.missions[index - 1].id)) return 'available';
    return 'locked';
  };

  const renderTrack = (track) => {
    const isLocked = track.locked;
    return (
      <div key={track.id} className="ps-track-section">
        <div className="ps-section-header">
          {'\u2550'.repeat(3)} TRACK {track.id === 'basic_training' ? '1' : '2'}: {track.name.toUpperCase()} {'\u2550'.repeat(3)}
          {isLocked && <span style={{ color: '#ff6600', marginLeft: '8px' }}>{'\uD83D\uDD12'} REQUIRES MINT</span>}
          {!isLocked && (
            <span style={{ color: '#888', marginLeft: '8px' }}>
              {completedMissions.filter(id => track.missions.some(m => m.id === id)).length === track.missions.length
                ? 'COMPLETE'
                : 'IN PROGRESS'}
            </span>
          )}
        </div>
        <div className="ps-mission-list">
          {track.missions.map((mission, i) => {
            const state = getMissionState(mission, i, track);
            const corp = CORPORATIONS[mission.corp];
            const diff = DIFFICULTIES[mission.difficulty];
            return (
              <div
                key={mission.id}
                className={`ps-mission-entry ${state}`}
                onClick={() => {
                  if (state === 'completed' || state === 'available') {
                    onSelectMission(mission);
                  }
                }}
              >
                <span className="ps-mission-status">
                  {state === 'completed' && <span style={{ color: '#00ff41' }}>{'\u2713'}</span>}
                  {state === 'available' && <span style={{ color: '#ffff00' }}>{'\u25B6'}</span>}
                  {state === 'locked' && <span style={{ color: '#555' }}>{'\u25FB'}</span>}
                  {state === 'mint-locked' && <span style={{ color: '#444' }}>{'\uD83D\uDD12'}</span>}
                </span>
                <span className="ps-mission-num">
                  #{String(mission.number).padStart(2, '0')}
                </span>
                <span className="ps-mission-corp-icon" style={{ color: corp?.color || '#888' }}>
                  {corp?.icon || '\u25C6'}
                </span>
                <span className="ps-mission-name">{mission.title}</span>
                <span className="ps-mission-sub">{mission.subtitle}</span>
                {diff && (
                  <span className="ps-mission-diff-mini" style={{ color: diff.color }}>
                    {'\u2588'.repeat(diff.bars)}{'\u2591'.repeat(4 - diff.bars)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="ps-mission-select">
      <div className="ps-progress-wrapper">
        <ProgressBar xp={xp} completedCount={completedMissions.length} totalCount={totalMissions} />
      </div>
      {renderTrack(TRACK_1)}
      {renderTrack(TRACK_2)}
    </div>
  );
}
