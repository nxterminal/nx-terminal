import { useState, useEffect, useCallback } from 'react';
import './MonadSDK.css';
import { EXERCISE_TYPES, RANKS } from './data/constants';
import BootSequence from './screens/BootSequence';
import MissionSelect from './screens/MissionSelect';
import QuizMission from './screens/QuizMission';
import CodeMission from './screens/CodeMission';
import CompilerOutput from './screens/CompilerOutput';
import CompilingOverlay from './components/CompilingOverlay';
import HelpDialog from './screens/HelpDialog';
import TRACK_1 from './data/missions-track1';
import TRACK_2 from './data/missions-track2';

const TOTAL_MISSIONS = TRACK_1.missions.length + TRACK_2.missions.length;

function Sidebar({ xp, completedMissions, currentRank }) {
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];
  const xpForNext = nextRank ? nextRank.xpRequired : currentRank.xpRequired;
  const xpInRank = xp - currentRank.xpRequired;
  const xpNeeded = nextRank ? xpForNext - currentRank.xpRequired : 1;
  const pct = nextRank ? Math.min(xpInRank / xpNeeded, 1) : 1;
  const t1Done = completedMissions.filter(id => TRACK_1.missions.some(m => m.id === id)).length;

  return (
    <div className="ms-sidebar">
      <div className="ms-sidebar-icon">{'\u26A1'}</div>
      <div className="ms-sidebar-title">MONAD_SDK</div>
      <div className="ms-sidebar-subtitle">Monad Training</div>

      <div className="ms-sidebar-divider" />

      <div className="ms-sidebar-label">RANK</div>
      <div className="ms-sidebar-rank" style={{ color: currentRank.color, textShadow: `0 0 6px ${currentRank.color}` }}>
        {currentRank.name}
      </div>

      <div className="ms-sidebar-xp-bar">
        <div className="ms-sidebar-xp-fill" style={{ width: `${pct * 100}%`, background: currentRank.color }} />
      </div>
      <div className="ms-sidebar-xp-text">{xp} / {xpForNext} XP</div>

      <div className="ms-sidebar-divider" />

      <div className="ms-sidebar-label">MISSIONS</div>
      <div className="ms-sidebar-missions">{completedMissions.length} of {TOTAL_MISSIONS}</div>
      <div className="ms-sidebar-missions-detail">Track 1: {t1Done}/{TRACK_1.missions.length}</div>
      <div className="ms-sidebar-missions-detail">Track 2: locked</div>

      <div className="ms-sidebar-footer">
        NX TERMINAL<br />{'\u00D7'} MONAD
      </div>
    </div>
  );
}

function MobileTopBar({ xp, currentRank, completedMissions }) {
  return (
    <div className="ms-mobile-topbar">
      <span className="ms-sidebar-rank" style={{ color: currentRank.color }}>{currentRank.name}</span>
      <span>{xp} XP</span>
      <span>|</span>
      <span>{completedMissions.length}/{TOTAL_MISSIONS} missions</span>
    </div>
  );
}

export default function MonadSDK({ onClose }) {
  const [screen, setScreen] = useState('boot');
  const [activeMission, setActiveMission] = useState(null);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [xp, setXp] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [compiling, setCompiling] = useState(false);
  const [compilePassed, setCompilePassed] = useState(false);
  const [missionResult, setMissionResult] = useState(null);

  const [compileTrigger, setCompileTrigger] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('monad_sdk_progress');
      if (saved) {
        const { completed, xp: savedXp } = JSON.parse(saved);
        setCompletedMissions(completed || []);
        setXp(savedXp || 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('monad_sdk_progress', JSON.stringify({
      completed: completedMissions,
      xp,
    }));
  }, [completedMissions, xp]);

  const currentRank = [...RANKS].reverse().find(r => xp >= r.xpRequired) || RANKS[0];

  const handleBootComplete = useCallback(() => setScreen('select'), []);

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
    localStorage.removeItem('monad_sdk_progress');
    sessionStorage.removeItem('monad_sdk_boot_seen');
    setShowResetConfirm(false);
    setOpenMenu(null);
    setActiveMission(null);
    setScreen('select');
  }, []);

  const handleMenuClick = (menu) => setOpenMenu(openMenu === menu ? null : menu);
  const closeMenu = () => setOpenMenu(null);

  const canCompile = screen === 'mission' && activeMission?.type === EXERCISE_TYPES.CODE;
  const isMission = screen === 'mission';
  const isResult = screen === 'result';

  const renderWizardBar = () => {
    if (screen === 'boot') return null;

    return (
      <div className="ms-wizard-bar">
        {(isMission || (isResult && !missionResult?.passed)) ? (
          <button className="ms-wiz-btn" onClick={handleBackToSelect}>
            {'\u25C0'} Missions
          </button>
        ) : (
          <button className="ms-wiz-btn" disabled>{'\u25C0'} Back</button>
        )}

        <div style={{ flex: 1 }} />

        {canCompile && (
          <button className="ms-wiz-btn" onClick={() => setCompileTrigger(t => t + 1)}>
            {'\u25B6'} Compile
          </button>
        )}
        {isResult && missionResult?.passed && (
          <button className="ms-wiz-btn" onClick={handleContinue}>
            {'\u25B6'} Continue
          </button>
        )}
        {isResult && !missionResult?.passed && (
          <button className="ms-wiz-btn" onClick={handleRetry}>
            {'\u25B6'} Retry
          </button>
        )}

        <button className="ms-wiz-btn" onClick={() => setShowHelp(true)}>Help</button>
      </div>
    );
  };

  return (
    <div className="ms-container" onClick={() => { if (openMenu) closeMenu(); }}>
      {/* Menu bar */}
      <div className="ms-menubar" onClick={(e) => e.stopPropagation()}>
        <div className="ms-menu-item" onClick={() => handleMenuClick('file')}>
          File
          {openMenu === 'file' && (
            <div className="ms-dropdown">
              <div className="ms-dropdown-item" onClick={() => { closeMenu(); setShowResetConfirm(true); }}>Reset Progress</div>
              <div className="ms-dropdown-sep" />
              <div className="ms-dropdown-item" onClick={() => { closeMenu(); if (onClose) onClose(); }}>Exit</div>
            </div>
          )}
        </div>
        <div className="ms-menu-item" onClick={() => handleMenuClick('mission')}>
          Mission
          {openMenu === 'mission' && (
            <div className="ms-dropdown">
              <div className="ms-dropdown-item" onClick={() => { closeMenu(); handleBackToSelect(); }}>Mission Select</div>
            </div>
          )}
        </div>
        <div
          className={`ms-menu-item${canCompile ? '' : ' disabled'}`}
          onClick={() => { if (canCompile) setCompileTrigger(t => t + 1); }}
        >
          Compile
        </div>
        <div className="ms-menu-item" onClick={() => { closeMenu(); setShowHelp(true); }}>Help</div>
      </div>

      {/* Mobile top bar */}
      <MobileTopBar xp={xp} currentRank={currentRank} completedMissions={completedMissions} />

      {/* Body */}
      <div className="ms-body">
        <Sidebar xp={xp} completedMissions={completedMissions} currentRank={currentRank} />

        <div className="ms-content">
          {screen === 'boot' && <BootSequence onComplete={handleBootComplete} />}

          {screen === 'select' && (
            <div className="ms-content-scroll">
              <MissionSelect completedMissions={completedMissions} xp={xp} onSelectMission={handleSelectMission} />
            </div>
          )}

          {screen === 'mission' && activeMission?.type === EXERCISE_TYPES.QUIZ && (
            <div className="ms-content-scroll">
              <QuizMission key={activeMission.id} mission={activeMission} onComplete={handleMissionComplete} />
            </div>
          )}

          {screen === 'mission' && activeMission?.type === EXERCISE_TYPES.CODE && (
            <div className="ms-content-scroll">
              <CodeMission key={activeMission.id} mission={activeMission} onCompile={handleMissionComplete} compileTrigger={compileTrigger} />
            </div>
          )}

          {screen === 'result' && activeMission && missionResult && (
            <CompilerOutput
              mission={activeMission}
              passed={missionResult.passed}
              details={missionResult.details}
              xp={xp}
              prevXp={xp - (missionResult.passed && !completedMissions.includes(activeMission.id) ? activeMission.xp : 0)}
            />
          )}
        </div>
      </div>

      {renderWizardBar()}

      {/* Status bar */}
      <div className="ms-statusbar">
        <div className="ms-statusbar-left">
          <span>RANK: </span>
          <span className="ms-rank" style={{ color: currentRank.color }}>{currentRank.name}</span>
          <span> | XP: {xp} | MISSIONS: {completedMissions.length}/{TOTAL_MISSIONS}</span>
        </div>
        <div className="ms-statusbar-right">MONAD_SDK BETA | NX TERMINAL {'\u00D7'} MONAD</div>
      </div>

      {/* Overlays */}
      {compiling && <CompilingOverlay success={compilePassed} onComplete={handleCompileFinish} />}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showResetConfirm && (
        <div className="ms-confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="ms-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ms-confirm-title">Reset Progress</div>
            <div className="ms-confirm-msg">This will erase all mission progress, XP, and rank. Are you sure?</div>
            <div className="ms-confirm-buttons">
              <button className="ms-confirm-btn" onClick={handleResetProgress}>Yes, Reset</button>
              <button className="ms-confirm-btn" onClick={() => setShowResetConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
