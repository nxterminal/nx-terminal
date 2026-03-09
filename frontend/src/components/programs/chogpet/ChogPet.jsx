import './ChogPet.css';
import PetSprite from './components/PetSprite';
import { usePetState } from './hooks/usePetState';
import { PET_TYPES, getLevel, getNextLevel } from './constants';

export default function ChogPet({ onClose }) {
  const {
    petType, name, hunger, happiness, xp, isActive, helperMode,
    feed, pet, changePet, toggleHelper, toggleActive, level,
  } = usePetState();

  const nextLevel = getNextLevel(xp);
  const xpProgress = nextLevel
    ? ((xp - level.xpRequired) / (nextLevel.xpRequired - level.xpRequired)) * 100
    : 100;

  return (
    <div className="cp-window">
      {/* Current pet info */}
      <div className="cp-header">
        <div className="cp-header-sprite">
          <PetSprite petType={petType} frame="idle" size={64} />
        </div>
        <div className="cp-header-info">
          <div className="cp-header-name">
            {PET_TYPES[petType]?.icon} {name}
            <span className="cp-header-level">{level.name}</span>
          </div>
          <div className="cp-header-xp">
            XP: {xp} {nextLevel ? `/ ${nextLevel.xpRequired}` : '(MAX)'}
          </div>

          <div className="cp-stat-row">
            <span className="cp-stat-label">Hunger</span>
            <div className="cp-stat-bar-bg">
              <div className="cp-stat-bar-fill hunger" style={{ width: `${hunger}%` }} />
            </div>
            <span className="cp-stat-value">{Math.round(hunger)}%</span>
          </div>

          <div className="cp-stat-row">
            <span className="cp-stat-label">Happiness</span>
            <div className="cp-stat-bar-bg">
              <div className="cp-stat-bar-fill happiness" style={{ width: `${happiness}%` }} />
            </div>
            <span className="cp-stat-value">{Math.round(happiness)}%</span>
          </div>

          <div className="cp-stat-row">
            <span className="cp-stat-label">Level XP</span>
            <div className="cp-stat-bar-bg">
              <div className="cp-stat-bar-fill xp" style={{ width: `${xpProgress}%` }} />
            </div>
            <span className="cp-stat-value">{Math.round(xpProgress)}%</span>
          </div>
        </div>
      </div>

      {/* Pet selector */}
      <div className="cp-selector">
        <div className="cp-selector-title">Choose Your Pet:</div>
        <div className="cp-pet-cards">
          {Object.entries(PET_TYPES).map(([key, p]) => (
            <div
              key={key}
              className={`cp-pet-card ${petType === key ? 'selected' : ''}`}
              onClick={() => changePet(key)}
            >
              <PetSprite petType={key} frame="idle" size={40} />
              <div className="cp-pet-card-name">{p.icon} {p.name}</div>
              <div className="cp-pet-card-desc">{p.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="cp-actions">
        <button className="cp-btn" onClick={feed}>
          {'\u{1F356}'} Feed
        </button>
        <button className="cp-btn" onClick={pet}>
          {'\u2764\uFE0F'} Pet
        </button>
        <button
          className={`cp-btn ${helperMode ? 'active' : ''}`}
          onClick={toggleHelper}
        >
          {'\u{1F4A1}'} Helper: {helperMode ? 'ON' : 'OFF'}
        </button>
        <button
          className={`cp-btn ${isActive ? '' : 'danger'}`}
          onClick={toggleActive}
        >
          {isActive ? '\u{1F44B} Dismiss Pet' : '\u{1F4E2} Summon Pet'}
        </button>
      </div>

      {/* Status bar */}
      <div className="cp-statusbar">
        <span>
          {PET_TYPES[petType]?.icon} {name} — Lv.{level.name}
          {hunger < 30 && ' \u{26A0}\uFE0F Hungry!'}
        </span>
        <span className="cp-statusbar-right">
          CHOGPET v1.0 | NX TERMINAL {'\u00D7'} MONAD
        </span>
      </div>
    </div>
  );
}
