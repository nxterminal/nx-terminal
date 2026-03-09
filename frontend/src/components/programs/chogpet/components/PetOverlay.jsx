import { useState, useEffect, useRef, useCallback } from 'react';
import PetSprite from './PetSprite';
import PetMenu from './PetMenu';
import DialogBubble from './DialogBubble';
import { usePetState } from '../hooks/usePetState';
import {
  MONAD_TIPS,
  TIP_INTERVAL_MIN,
  TIP_INTERVAL_MAX,
  WALK_INTERVAL_MIN,
  WALK_INTERVAL_MAX,
  BLINK_INTERVAL,
  BUBBLE_DURATION,
  TIP_XP,
} from '../constants';

export default function PetOverlay({ openWindow }) {
  const petState = usePetState();
  const {
    petType, name, hunger, happiness, xp, isActive, helperMode, position,
    feed, pet, toggleHelper, toggleActive, setPosition, addXP, level,
  } = petState;

  const [frame, setFrame] = useState('idle');
  const [menuPos, setMenuPos] = useState(null);
  const [bubbleText, setBubbleText] = useState('');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [particles, setParticles] = useState([]);
  const [facingLeft, setFacingLeft] = useState(false);

  const dragRef = useRef(null);
  const overlayRef = useRef(null);
  const walkRef = useRef(null);
  const animTimeoutRef = useRef(null);
  const tipIndexRef = useRef(Math.floor(Math.random() * MONAD_TIPS.length));

  const spriteSize = level.spriteSize;

  // Blinking animation
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (frame === 'idle') {
        setFrame('blink');
        setTimeout(() => setFrame('idle'), 200);
      }
    }, BLINK_INTERVAL);
    return () => clearInterval(interval);
  }, [isActive, frame]);

  // Sad state when hungry
  useEffect(() => {
    if (hunger < 30 && frame === 'idle') {
      setFrame('sad');
    } else if (hunger >= 30 && frame === 'sad') {
      setFrame('idle');
    }
  }, [hunger, frame]);

  // Walking behavior
  useEffect(() => {
    if (!isActive) return;
    const scheduleWalk = () => {
      const delay = WALK_INTERVAL_MIN + Math.random() * (WALK_INTERVAL_MAX - WALK_INTERVAL_MIN);
      walkRef.current = setTimeout(() => {
        const maxX = window.innerWidth - spriteSize - 20;
        const targetX = Math.floor(Math.random() * maxX);
        const currentX = position.x;
        setFacingLeft(targetX < currentX);

        // Animate walk
        const startX = currentX;
        const distance = targetX - startX;
        const duration = Math.abs(distance) * 5; // 5ms per pixel
        const startTime = performance.now();

        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const easedProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          const newX = startX + distance * easedProgress;
          setPosition({ x: Math.round(newX), y: null });

          if (progress < 1) {
            walkRef.current = requestAnimationFrame(animate);
          } else {
            setFacingLeft(false);
            scheduleWalk();
          }
        };

        if (happiness > 20) {
          walkRef.current = requestAnimationFrame(animate);
        } else {
          scheduleWalk();
        }
      }, delay);
    };

    scheduleWalk();
    return () => {
      if (walkRef.current) {
        clearTimeout(walkRef.current);
        cancelAnimationFrame(walkRef.current);
      }
    };
  }, [isActive, spriteSize, happiness, position.x, setPosition]);

  // Helper mode tips
  useEffect(() => {
    if (!isActive || !helperMode) return;
    const showTip = () => {
      const tip = MONAD_TIPS[tipIndexRef.current % MONAD_TIPS.length];
      tipIndexRef.current++;
      setBubbleText(tip);
      setBubbleVisible(true);
      addXP(TIP_XP);
      setTimeout(() => setBubbleVisible(false), BUBBLE_DURATION);
    };
    const delay = TIP_INTERVAL_MIN + Math.random() * (TIP_INTERVAL_MAX - TIP_INTERVAL_MIN);
    const interval = setInterval(showTip, delay);
    // Show first tip after a short delay
    const firstTip = setTimeout(showTip, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(firstTip);
    };
  }, [isActive, helperMode, addXP]);

  // Event reactions
  useEffect(() => {
    const handleDevHired = () => {
      triggerAnimation('happy');
      showBubble('A new dev joins the team!');
    };
    window.addEventListener('nx-dev-hired', handleDevHired);
    return () => window.removeEventListener('nx-dev-hired', handleDevHired);
  }, []);

  const triggerAnimation = useCallback((anim, duration = 800) => {
    setFrame(anim);
    clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => {
      setFrame(hunger < 30 ? 'sad' : 'idle');
    }, duration);
  }, [hunger]);

  const showBubble = useCallback((text) => {
    setBubbleText(text);
    setBubbleVisible(true);
    setTimeout(() => setBubbleVisible(false), BUBBLE_DURATION);
  }, []);

  // Click handler (pet the pet)
  const handleClick = useCallback((e) => {
    if (e.button !== 0) return;
    pet();
    triggerAnimation('happy');

    // Spawn particles
    const newParticles = Array.from({ length: 3 }, (_, i) => ({
      id: Date.now() + i,
      emoji: ['\u2764\uFE0F', '\u2728', '\u{1F49C}'][i],
      x: Math.random() * 40 - 20,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, [pet, triggerAnimation]);

  // Right-click handler
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Drag handler
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      moved: false,
    };

    const handleMouseMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 3) dragRef.current.moved = true;
      const newX = Math.max(0, Math.min(window.innerWidth - spriteSize,
        dragRef.current.origX + dx));
      setPosition({ x: newX, y: null });
    };

    const handleMouseUp = (e) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!dragRef.current?.moved) {
        handleClick(e);
      }
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position.x, spriteSize, setPosition, handleClick]);

  // Feed with particles
  const handleFeed = useCallback(() => {
    feed();
    triggerAnimation('eating', 600);
    const newParticles = Array.from({ length: 4 }, (_, i) => ({
      id: Date.now() + i,
      emoji: ['\u{1F356}', '\u{1F357}', '\u{1F969}', '\u2728'][i],
      x: Math.random() * 50 - 25,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, [feed, triggerAnimation]);

  if (!isActive) return null;

  const posX = Math.max(0, Math.min(position.x, window.innerWidth - spriteSize));

  return (
    <div
      className="cp-overlay"
      ref={overlayRef}
      style={{
        position: 'fixed',
        left: `${posX}px`,
        bottom: '38px',
        zIndex: 9997,
      }}
    >
      {/* Dialog bubble */}
      <DialogBubble text={bubbleText} visible={bubbleVisible} />

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="cp-particle"
          style={{ left: `${spriteSize / 2 + p.x}px` }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Shadow */}
      <div
        className="cp-shadow"
        style={{
          width: `${spriteSize * 0.7}px`,
          left: `${spriteSize * 0.15}px`,
        }}
      />

      {/* Pet sprite */}
      <div
        className={`cp-pet-container ${frame === 'happy' ? 'cp-bounce' : ''}`}
        style={{
          transform: facingLeft ? 'scaleX(-1)' : 'none',
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        <PetSprite
          petType={petType}
          frame={frame}
          size={spriteSize}
        />
      </div>

      {/* Name tag */}
      <div className="cp-name-tag">{name}</div>

      {/* Context menu */}
      {menuPos && (
        <PetMenu
          position={menuPos}
          onClose={() => setMenuPos(null)}
          onFeed={handleFeed}
          onPet={() => { pet(); triggerAnimation('happy'); }}
          onStatus={() => openWindow('chogpet')}
          onHelper={toggleHelper}
          onDismiss={toggleActive}
          helperMode={helperMode}
        />
      )}
    </div>
  );
}
