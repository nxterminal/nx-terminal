import { useState, useEffect, useCallback } from 'react';
import './PharosSDK.css';
import { EXERCISE_TYPES, RANKS } from './data/constants';
import BootSequence from './screens/BootSequence';
import MissionSelect from './screens/MissionSelect';
import QuizMission from './screens/QuizMission';
import CodeMission from './screens/CodeMission';
import CompilerOutput from './screens/CompilerOutput';
import CompilingOverlay from './components/CompilingOverlay';
import ProgressBar from './components/ProgressBar';
import HelpDialog from './screens/HelpDialog';
import TRACK_1 from './data/missions-track1';
import TRACK_2 from './data/missions-track2';

const TOTAL_MISSIONS = TRACK_1.missions.length + TRACK_2.missions.length;

export default function PharosSDK({ onClose }) {
  const [screen, setScreen] = useState('boot');
  const [activeMission, setActiveMission] = useState(null);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [xp, setXp] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Compiling overlay state
  const [compiling, setCompiling] = useState(false);
  const [compilePassed, setCompilePassed] = useState(false);
  const [missionResult, setMissionResult] = useState(null);

  // Load saved progress
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pharos_sdk_progress');
      if (saved) {
        const { completed, xp: savedXp } = JSON.parse(saved);
        setCompletedMissions(completed || []);
        setXp(savedXp || 0);
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Save progress
  useEffect(() => {
    localStorage.setItem('pharos_sdk_progress', JSON.stringify({
      completed: completedMissions,
      xp: xp,
    }));
  }, [completedMissions, xp]);

  const currentRank = [...RANKS].reverse().find(r => xp >= r.xpRequired) || RANKS[0];

  const handleBootComplete = useCallback(() => {
    setScreen('select');
  }, []);

  const handleSelectMission = useCallback((mission) => {
    setActiveMission(mission);
    setMissionResult(null);
    setScreen('mission');
  }, []);

  const handleMissionComplete = useCallback((passed, details) => {
    setCompilePassed(passed);
    setMissionResult({ passed, details });
    setCompiling(true);
  }, []);

  const handleCompileFinish = useCallback(() => {
    setCompiling(false);
    setScreen('result');
  }, []);

  const handleContinue = useCallback(() => {
    if (activeMission && !completedMissions.includes(activeMission.id)) {
      setCompletedMissions(prev => [...prev, activeMission.id]);
      setXp(prev => prev + (activeMission.xp || 0));
    }
    setActiveMission(null);
    setMissionResult(null);
    setScreen('select');
  }, [activeMission, completedMissions]);

  const handleRetry = useCallback(() => {
    setMissionResult(null);
    setScreen('mission');
  }, []);

  const handleBackToSelect = useCallback(() => {
    setActiveMission(null);
    setMissionResult(null);
    setScreen('select');
  }, []);

  const handleResetProgress = useCallback(() => {
    setCompletedMissions([]);
    setXp(0);
    localStorage.removeItem('pharos_sdk_progress');
    sessionStorage.removeItem('pharos_sdk_boot_seen');
    setShowResetConfirm(false);
    setOpenMenu(null);
    setActiveMission(null);
    setScreen('select');
  }, []);

  const handleMenuClick = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenu = () => setOpenMenu(null);

  // Can compile: in a code mission with screen === 'mission'
  const canCompile = screen === 'mission' && activeMission?.type === EXERCISE_TYPES.CODE;

  return (
    <div
      className="ps-container"
      onClick={() => { if (openMenu) closeMenu(); }}
    >
      {/* Boot overlay */}
      {screen === 'boot' && <BootSequence onComplete={handleBootComplete} />}

      {/* Menu bar */}
      <div className="ps-menubar" onClick={(e) => e.stopPropagation()}>
        <div className="ps-menu-item" onClick={() => handleMenuClick('file')}>
          FILE
          {openMenu === 'file' && (
            <div className="ps-dropdown">
              <div className="ps-dropdown-item" onClick={() => {
                closeMenu();
                setShowResetConfirm(true);
              }}>
                Reset Progress
              </div>
              <div className="ps-dropdown-sep" />
              <div className="ps-dropdown-item" onClick={() => {
                closeMenu();
                if (onClose) onClose();
              }}>
                Exit
              </div>
            </div>
          )}
        </div>
        <div className="ps-menu-item" onClick={() => handleMenuClick('mission')}>
          MISSION
          {openMenu === 'mission' && (
            <div className="ps-dropdown">
              <div className="ps-dropdown-item" onClick={() => {
                closeMenu();
                handleBackToSelect();
              }}>
                Mission Select
              </div>
            </div>
          )}
        </div>
        <div className={`ps-menu-item${canCompile ? '' : ' disabled'}`}>
          COMPILE
        </div>
        <div className="ps-menu-item" onClick={() => { closeMenu(); setShowHelp(true); }}>
          HELP
        </div>
      </div>

      {/* Main content */}
      <div className="ps-main">
        {screen === 'select' && (
          <MissionSelect
            completedMissions={completedMissions}
            xp={xp}
            onSelectMission={handleSelectMission}
          />
        )}
        {screen === 'mission' && activeMission?.type === EXERCISE_TYPES.QUIZ && (
          <QuizMission
            key={activeMission.id}
            mission={activeMission}
            onComplete={handleMissionComplete}
            onBack={handleBackToSelect}
          />
        )}
        {screen === 'mission' && activeMission?.type === EXERCISE_TYPES.CODE && (
          <CodeMission
            key={activeMission.id}
            mission={activeMission}
            onCompile={handleMissionComplete}
            onBack={handleBackToSelect}
          />
        )}
        {screen === 'result' && activeMission && missionResult && (
          <CompilerOutput
            mission={activeMission}
            passed={missionResult.passed}
            details={missionResult.details}
            onContinue={handleContinue}
            onRetry={handleRetry}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="ps-statusbar">
        <div className="ps-statusbar-left">
          <span>RANK: </span>
          <span className="ps-rank" style={{ color: currentRank.color }}>{currentRank.name}</span>
          <span> | XP: {xp} | MISSIONS: {completedMissions.length}/{TOTAL_MISSIONS}</span>
        </div>
        <div className="ps-statusbar-right">
          PHAROS_SDK BETA | NX TERMINAL {'\u00D7'} PHAROS
        </div>
      </div>

      {/* Overlays */}
      {compiling && (
        <CompilingOverlay success={compilePassed} onComplete={handleCompileFinish} />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showResetConfirm && (
        <div className="ps-confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="ps-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ps-confirm-title">Reset Progress</div>
            <div className="ps-confirm-msg">
              This will erase all mission progress, XP, and rank.
              Are you sure?
            </div>
            <div className="ps-confirm-buttons">
              <button className="ps-confirm-btn" onClick={handleResetProgress}>Yes, Reset</button>
              <button className="ps-confirm-btn" onClick={() => setShowResetConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
