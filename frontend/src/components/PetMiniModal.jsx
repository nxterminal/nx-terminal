import { useState, useEffect, useRef, useCallback } from 'react';
import PetSprite from './programs/chogpet/components/PetSprite';
import DialogBubble from './programs/chogpet/components/DialogBubble';
import { usePetState } from './programs/chogpet/hooks/usePetState';
import {
  MEGAETH_TIPS,
  TIP_INTERVAL_MIN,
  TIP_INTERVAL_MAX,
  BLINK_INTERVAL,
  BUBBLE_DURATION,
  TIP_XP,
  DAILY_LIMITS,
} from './programs/chogpet/constants';

export default function PetMiniModal({ openWindow }) {
  const petState = usePetState();
  const {
    petType, name, hunger, happiness, isActive, helperMode,
    feed, pet, toggleHelper, addXP, level,
    feedMaxed, petMaxed,
  } = petState;

  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('nx-pet-enabled') !== 'false'; } catch { return true; }
  });
  const [pos, setPos] = useState({ x: 80, y: window.innerHeight - 320 });
  const [frame, setFrame] = useState('idle');
  const [bubbleText, setBubbleText] = useState('');
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const dragRef = useRef(null);
  const modalRef = useRef(null);
  const animTimeoutRef = useRef(null);
  const tipIndexRef = useRef(Math.floor(Math.random() * MEGAETH_TIPS.length));

  // Listen for toggle from taskbar
  useEffect(() => {
    const handler = () => {
      const on = localStorage.getItem('nx-pet-enabled') !== 'false';
      setVisible(on);
    };
    window.addEventListener('nx-pet-toggled', handler);
    return () => window.removeEventListener('nx-pet-toggled', handler);
  }, []);

  // Blinking
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      if (frame === 'idle') {
        setFrame('blink');
        setTimeout(() => setFrame('idle'), 200);
      }
    }, BLINK_INTERVAL);
    return () => clearInterval(interval);
  }, [visible, frame]);

  // Sad when hungry
  useEffect(() => {
    if (hunger < 30 && frame === 'idle') setFrame('sad');
    else if (hunger >= 30 && frame === 'sad') setFrame('idle');
  }, [hunger, frame]);

  // Helper tips
  useEffect(() => {
    if (!visible || !helperMode) return;
    const showTip = () => {
      const tip = MEGAETH_TIPS[tipIndexRef.current % MEGAETH_TIPS.length];
      tipIndexRef.current++;
      setBubbleText(tip);
      setBubbleVisible(true);
      addXP(TIP_XP);
      setTimeout(() => setBubbleVisible(false), BUBBLE_DURATION);
    };
    const delay = TIP_INTERVAL_MIN + Math.random() * (TIP_INTERVAL_MAX - TIP_INTERVAL_MIN);
    const interval = setInterval(showTip, delay);
    const first = setTimeout(showTip, 5000);
    return () => { clearInterval(interval); clearTimeout(first); };
  }, [visible, helperMode, addXP]);

  const [spriteAnim, setSpriteAnim] = useState('');
  const spriteAnimRef = useRef(null);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const hoverTimerRef = useRef(null);

  const onBtnEnter = useCallback((btn) => {
    hoverTimerRef.current = setTimeout(() => setHoveredBtn(btn), 400);
  }, []);
  const onBtnLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredBtn(null);
  }, []);

  const triggerSpriteAnim = useCallback((cls) => {
    setSpriteAnim(cls);
    clearTimeout(spriteAnimRef.current);
    spriteAnimRef.current = setTimeout(() => setSpriteAnim(''), 600);
  }, []);

  const triggerAnim = useCallback((anim, dur = 800) => {
    setFrame(anim);
    clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => setFrame(hunger < 30 ? 'sad' : 'idle'), dur);
  }, [hunger]);

  const showBubble = useCallback((text) => {
    setBubbleText(text);
    setBubbleVisible(true);
    setTimeout(() => setBubbleVisible(false), BUBBLE_DURATION);
  }, []);

  const handleFeed = useCallback(() => {
    if (feedMaxed) { showBubble("I'm full for today!"); return; }
    feed();
    triggerAnim('eating', 600);
    triggerSpriteAnim('cp-feed-anim');
  }, [feed, feedMaxed, showBubble, triggerAnim, triggerSpriteAnim]);

  const handlePet = useCallback(() => {
    if (petMaxed) { showBubble('Zzz... let me rest'); return; }
    pet();
    triggerAnim('happy');
    triggerSpriteAnim('cp-pet-anim');
  }, [pet, petMaxed, showBubble, triggerAnim, triggerSpriteAnim]);

  // Drag
  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const onMove = (ev) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 170, ev.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - 250, ev.clientY - offsetY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9997,
        width: 160,
        userSelect: 'none',
      }}
    >
      {/* Tip bubble above modal */}
      {bubbleVisible && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          background: '#8b956d',
          border: '2px solid #2d3020',
          borderRadius: 4,
          padding: '5px 8px',
          maxWidth: 200,
          minWidth: 120,
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: 10, color: '#2d3020', lineHeight: 1.3 }}>
            {bubbleText}
          </div>
          <div style={{
            position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '7px solid #2d3020',
          }} />
        </div>
      )}

      {/* Tamagotchi shell */}
      <div style={{
        background: 'linear-gradient(180deg, #d0d0d0 0%, #a0a0a0 30%, #d0d0d0 100%)',
        borderRadius: 16,
        border: '2px solid #888',
        boxShadow: '2px 3px 8px rgba(0,0,0,0.3)',
      }}>
        {/* Drag handle / label */}
        <div
          onMouseDown={handleDragStart}
          style={{
            textAlign: 'center',
            padding: '5px 0 3px',
            fontSize: 10,
            fontWeight: 'bold',
            color: '#606060',
            letterSpacing: 2,
            cursor: 'grab',
            fontFamily: '"Courier New", monospace',
            textTransform: 'uppercase',
          }}
        >
          MEGAGOTCHI
        </div>

        {/* LCD frame */}
        <div style={{
          margin: '0 10px',
          padding: 4,
          background: '#606060',
          borderRadius: 6,
          border: '2px solid',
          borderColor: '#555 #888 #888 #555',
        }}>
          {/* LCD screen */}
          <div style={{
            background: '#8b956d',
            border: '2px solid',
            borderColor: '#6b7558 #a3ad8a #a3ad8a #6b7558',
            borderRadius: 3,
            padding: 6,
            minHeight: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}>
            {/* Pet */}
            <div className={spriteAnim}>
              <PetSprite petType={petType} frame={frame} size={48} monochrome />
            </div>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 9, color: '#2d3020', textAlign: 'center' }}>
              {name}
            </div>

            {/* Mini stat bars */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Hunger */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, fontFamily: '"Courier New", monospace', color: '#2d3020' }}>
                <span style={{ width: 28 }}>HNG</span>
                <div style={{ flex: 1, height: 5, background: '#a3ad8a', border: '1px solid #2d3020' }}>
                  <div style={{ height: '100%', width: `${hunger}%`, background: '#2d3020' }} />
                </div>
              </div>
              {/* Happiness */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, fontFamily: '"Courier New", monospace', color: '#2d3020' }}>
                <span style={{ width: 28 }}>HPY</span>
                <div style={{ flex: 1, height: 5, background: '#a3ad8a', border: '1px solid #2d3020' }}>
                  <div style={{ height: '100%', width: `${happiness}%`, background: '#2d3020' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, padding: '8px 0 6px' }}>
          <MiniBtn label="F" text="FEED" onClick={handleFeed} disabled={feedMaxed} color="feed" tooltip="Feed — Give food to your pet. Restores hunger. 8 feeds per day." hoveredBtn={hoveredBtn} onEnter={onBtnEnter} onLeave={onBtnLeave} />
          <MiniBtn label="P" text="PET" onClick={handlePet} disabled={petMaxed} color="pet" tooltip="Pet — Show affection. Restores happiness. 15 pets per day." hoveredBtn={hoveredBtn} onEnter={onBtnEnter} onLeave={onBtnLeave} />
          <MiniBtn label="T" text="TIPS" onClick={toggleHelper} color="tips" tooltip="Tips — Toggle MegaETH tips. Earn XP when tips appear." hoveredBtn={hoveredBtn} onEnter={onBtnEnter} onLeave={onBtnLeave} />
        </div>
      </div>
    </div>
  );
}

const MINI_BTN_COLORS = {
  feed: { bg: 'linear-gradient(180deg, #50ff80 0%, #30dd50 100%)', color: '#0a3a0a', border: '#70ffa0 #1a8a35 #1a8a35 #70ffa0' },
  pet:  { bg: 'linear-gradient(180deg, #ff8ec4 0%, #dd5090 100%)', color: '#3a0a20', border: '#ffaad4 #aa3070 #aa3070 #ffaad4' },
  tips: { bg: 'linear-gradient(180deg, #a060e0 0%, #7B2FBE 100%)', color: '#fff',    border: '#c080ff #5a1a90 #5a1a90 #c080ff' },
};

function MiniBtn({ label, text, onClick, disabled, color, tooltip, hoveredBtn, onEnter, onLeave }) {
  const c = MINI_BTN_COLORS[color] || {};
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => onEnter(color)}
      onMouseLeave={onLeave}
    >
      {hoveredBtn === color && tooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, background: '#ffffe1', border: '1px solid #000',
          padding: '0.35em 0.7em', fontFamily: '"Tahoma", "MS Sans Serif", sans-serif',
          fontSize: 'var(--text-sm)', color: '#000', whiteSpace: 'normal', zIndex: 30,
          pointerEvents: 'none', boxShadow: '1px 1px 0 #808080',
          maxWidth: 200, lineHeight: 1.3, minWidth: 120,
        }}>
          {tooltip}
        </div>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          padding: 0,
        }}
      >
        <span style={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: c.bg || 'linear-gradient(180deg, #999 0%, #777 100%)',
          borderRadius: '50%',
          border: '2px solid',
          borderColor: c.border || '#aaa #666 #666 #aaa',
          fontFamily: '"Courier New", monospace',
          fontSize: 10,
          fontWeight: 'bold',
          color: c.color || '#333',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>
          {label}
        </span>
        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 7, color: '#606060', textTransform: 'uppercase' }}>
          {text}
        </span>
      </button>
    </div>
  );
}
