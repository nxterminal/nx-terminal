import { useState } from 'react';
import { CORPORATIONS, DIFFICULTIES } from '../data/constants';
import TRACK_1 from '../data/missions-track1';
import TRACK_2 from '../data/missions-track2';

export default function MissionSelect({ completedMissions, onSelectMission }) {
  const [showTrack2, setShowTrack2] = useState(false);

  const getMissionState = (mission, index, track) => {
    if (track.locked) return 'locked';
    if (completedMissions.includes(mission.id)) return 'completed';
    if (index === 0) return 'available';
    if (completedMissions.includes(track.missions[index - 1].id)) return 'available';
    return 'locked';
  };

  return (
    <div>
      <div className="ps-select-welcome">Welcome to MEGA_SDK Training</div>
      <div className="ps-select-desc">
        Complete missions to learn blockchain development on MegaETH.
        Each mission is guided by one of the six Protocol Wars corporations.
      </div>

      {/* Track 1 */}
      <div className="ps-track-label">
        {'\u2550\u2550\u2550'} TRACK 1: BASIC TRAINING {'\u2550\u2550\u2550'}
      </div>

      <div className="ps-mission-list-panel">
        {TRACK_1.missions.map((mission, i) => {
          const state = getMissionState(mission, i, TRACK_1);
          const corp = CORPORATIONS[mission.corp];
          const diff = DIFFICULTIES[mission.difficulty];
          return (
            <div
              key={mission.id}
              className={`ps-mission-row ${state}`}
              onClick={() => {
                if (state === 'completed' || state === 'available') onSelectMission(mission);
              }}
            >
              <span className="ps-mission-row-status">
                {state === 'completed' && <span style={{ color: '#008800' }}>{'\u2713'}</span>}
                {state === 'available' && <span style={{ color: '#000080' }}>{'\u25B6'}</span>}
                {state === 'locked' && <span style={{ color: '#aaa' }}>{'\u25CB'}</span>}
              </span>
              <span className="ps-mission-row-num">
                {String(mission.number).padStart(2, '0')}
              </span>
              <span className="ps-mission-row-corp" style={{ color: corp?.color || '#888' }}>
                {corp?.icon || '\u25C6'}
              </span>
              <span className="ps-mission-row-info">
                <span className="ps-mission-row-title">{mission.title}</span>
                <span className="ps-mission-row-sub">{mission.subtitle}</span>
              </span>
              <span className="ps-mission-row-right">
                <span className="ps-mission-row-xp">{mission.xp}xp</span>
                {diff && (
                  <span className="ps-mission-row-diff" style={{ color: diff.color }}>
                    {'\u2588'.repeat(diff.bars)}{'\u2591'.repeat(4 - diff.bars)}
                  </span>
                )}
                {state === 'available' && (
                  <button
                    className="ps-start-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectMission(mission); }}
                  >
                    START
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Track 2 */}
      <div className="ps-track-label">
        {'\u2550\u2550\u2550'} TRACK 2: CORPORATE WARFARE {'\u2550\u2550\u2550'} <span style={{ color: '#cc6600' }}>{'\uD83D\uDD12'} REQUIRES MINT</span>
      </div>

      <div className="ps-track2-box">
        <div>
          10 advanced missions covering DeFi, security, and MegaETH architecture.
          Available for NX Terminal NFT holders after mint.
        </div>
        <span
          className="ps-track2-toggle"
          onClick={() => setShowTrack2(!showTrack2)}
        >
          {showTrack2 ? 'Hide locked missions \u25B4' : 'View locked missions \u25BE'}
        </span>
        {showTrack2 && (
          <div className="ps-track2-locked-list">
            {TRACK_2.missions.map((m) => (
              <div key={m.id} className="ps-track2-locked-item">
                {'\uD83D\uDD12'} #{String(m.number).padStart(2, '0')} {m.title} {'\u2014'} {m.subtitle}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
