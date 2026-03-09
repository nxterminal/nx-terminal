import { useState, useRef, useCallback } from 'react';
import './ChogPet.css';
import PetSprite from './components/PetSprite';
import { usePetState } from './hooks/usePetState';
import { PET_TYPES, DAILY_LIMITS, getLevel, getNextLevel } from './constants';

function BtnTooltip({ text }) {
  return <div className="cp-btn-tooltip">{text}</div>;
}

export default function ChogPet({ onClose }) {
  const {
    petType, name, hunger, happiness, xp, isActive, helperMode,
    feed, pet, changePet, toggleHelper, toggleActive, level,
    dailyFeeds = 0, dailyPets = 0, feedMaxed, petMaxed,
  } = usePetState();

  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [spriteAnim, setSpriteAnim] = useState('');
  const hoverTimerRef = useRef(null);
  const animTimerRef = useRef(null);

  const onBtnEnter = useCallback((btn) => {
    hoverTimerRef.current = setTimeout(() => setHoveredBtn(btn), 400);
  }, []);
  const onBtnLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredBtn(null);
  }, []);

  const triggerSpriteAnim = useCallback((cls) => {
    setSpriteAnim(cls);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setSpriteAnim(''), 600);
  }, []);

  const handleFeed = useCallback(() => {
    if (!feedMaxed) { feed(); triggerSpriteAnim('cp-feed-anim'); }
  }, [feed, feedMaxed, triggerSpriteAnim]);

  const handlePet = useCallback(() => {
    if (!petMaxed) { pet(); triggerSpriteAnim('cp-pet-anim'); }
  }, [pet, petMaxed, triggerSpriteAnim]);

  const nextLevel = getNextLevel(xp);
  const xpProgress = nextLevel
    ? ((xp - level.xpRequired) / (nextLevel.xpRequired - level.xpRequired)) * 100
    : 100;

  const hungerIcon = hunger > 60 ? '*' : hunger > 30 ? '~' : '!';
  const happyIcon = happiness > 60 ? '*' : happiness > 30 ? '~' : '!';

  return (
    <div className="cp-window">
      {/* Shell top label */}
      <div className="cp-shell-label">MONADGOTCHI</div>

      {/* LCD Screen */}
      <div className="cp-lcd-frame">
        <div className="cp-lcd-screen">
          {/* Icon bar */}
          <div className="cp-lcd-iconbar">
            <span title="Hunger">{hungerIcon}HNG</span>
            <span title="Happiness">{happyIcon}HPY</span>
            <span title="Level">Lv.{level.name}</span>
            <span title="Helper">{helperMode ? '[TIP]' : ''}</span>
          </div>

          {/* Pet display area */}
          <div className="cp-lcd-pet-area">
            <div className={`cp-lcd-sprite ${spriteAnim}`}>
              <PetSprite petType={petType} frame="idle" size={56} monochrome />
            </div>
            <div className="cp-lcd-pet-info">
              <div className="cp-lcd-pet-name">{name}</div>
              <div className="cp-lcd-pet-level">Lv.{level.name}</div>
              <div className="cp-lcd-pet-xp">XP: {xp}</div>
            </div>
          </div>

          {/* Stat bars */}
          <div className="cp-lcd-stats">
            <div className="cp-lcd-stat-row">
              <span className="cp-lcd-stat-label">Hunger:</span>
              <div className="cp-lcd-bar">
                <div className="cp-lcd-bar-fill" style={{ width: `${hunger}%` }} />
              </div>
              <span className="cp-lcd-stat-val">{Math.round(hunger)}%</span>
            </div>
            <div className="cp-lcd-stat-row">
              <span className="cp-lcd-stat-label">Happy:</span>
              <div className="cp-lcd-bar">
                <div className="cp-lcd-bar-fill" style={{ width: `${happiness}%` }} />
              </div>
              <span className="cp-lcd-stat-val">{Math.round(happiness)}%</span>
            </div>
            <div className="cp-lcd-stat-row">
              <span className="cp-lcd-stat-label">Feeds:</span>
              <span className="cp-lcd-stat-counter">{dailyFeeds}/{DAILY_LIMITS.maxFeeds} today</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Physical buttons */}
      <div className="cp-buttons">
        <div style={{ position: 'relative' }} onMouseEnter={() => onBtnEnter('feed')} onMouseLeave={onBtnLeave}>
          {hoveredBtn === 'feed' && <BtnTooltip text="Feed — Give food to your pet. Restores hunger. 8 feeds per day." />}
          <button className="cp-hw-btn" onClick={handleFeed} disabled={feedMaxed}>
            <span className="cp-hw-btn-label cp-btn-feed">F</span>
            <span className="cp-hw-btn-text">FEED</span>
          </button>
        </div>
        <div style={{ position: 'relative' }} onMouseEnter={() => onBtnEnter('pet')} onMouseLeave={onBtnLeave}>
          {hoveredBtn === 'pet' && <BtnTooltip text="Pet — Show affection. Restores happiness. 15 pets per day." />}
          <button className="cp-hw-btn" onClick={handlePet} disabled={petMaxed}>
            <span className="cp-hw-btn-label cp-btn-pet">P</span>
            <span className="cp-hw-btn-text">PET</span>
          </button>
        </div>
        <div style={{ position: 'relative' }} onMouseEnter={() => onBtnEnter('tips')} onMouseLeave={onBtnLeave}>
          {hoveredBtn === 'tips' && <BtnTooltip text="Tips — Toggle Monad tips. Earn XP when tips appear." />}
          <button className="cp-hw-btn" onClick={toggleHelper}>
            <span className="cp-hw-btn-label cp-btn-tips">T</span>
            <span className="cp-hw-btn-text">TIPS {helperMode ? 'ON' : 'OFF'}</span>
          </button>
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
              <PetSprite petType={key} frame="idle" size={24} silhouette />
              <div className="cp-pet-card-name">{p.icon} {p.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="cp-statusbar">
        <span>
          {PET_TYPES[petType]?.icon} {name} -- Lv.{level.name}
          {hunger < 30 && ' [!] Hungry!'}
        </span>
        <span className="cp-statusbar-right">
          MONADGOTCHI v1.0 | NX TERMINAL x MONAD
        </span>
      </div>
    </div>
  );
}
