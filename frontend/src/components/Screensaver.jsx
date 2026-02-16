import { useEffect, useRef, useState } from 'react';

const PIPE_COLORS = [
  '#33ff33', // green
  '#ff8800', // orange
  '#0066cc', // blue
  '#cc0000', // red
  '#cc9900', // gold
  '#cc33cc', // pink
];

const DIRECTIONS = [
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 },  // down
  { dx: -1, dy: 0 }, // left
  { dx: 1, dy: 0 },  // right
];

const PIPE_WIDTH = 8;
const STEP_SIZE = 16;
const TURN_CHANCE = 0.2;
const MAX_SEGMENTS = 50;
const MIN_SEGMENTS_BEFORE_NEW = 30;
const FRAMES_PER_SEGMENT = 3;

export default function Screensaver({ active, onDeactivate }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Fade in when active becomes true
  useEffect(() => {
    if (active) {
      // Small delay so transition fires
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [active]);

  // Main pipe drawing loop
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Clear to black
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pipe state
    let x, y, dir, colorIdx, segmentCount, frameCount;

    function startNewPipe() {
      x = Math.floor(Math.random() * (canvas.width / STEP_SIZE)) * STEP_SIZE;
      y = Math.floor(Math.random() * (canvas.height / STEP_SIZE)) * STEP_SIZE;
      dir = Math.floor(Math.random() * 4);
      colorIdx = (colorIdx !== undefined ? colorIdx + 1 : Math.floor(Math.random() * PIPE_COLORS.length)) % PIPE_COLORS.length;
      segmentCount = 0;
    }

    frameCount = 0;
    startNewPipe();

    function drawPipeSegment(fromX, fromY, toX, toY, color) {
      const half = PIPE_WIDTH / 2;

      // Main pipe body
      ctx.strokeStyle = color;
      ctx.lineWidth = PIPE_WIDTH;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // 3D highlight (lighter top/left edge)
      ctx.strokeStyle = lightenColor(color, 60);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (fromX === toX) {
        // Vertical pipe - highlight on left
        ctx.moveTo(fromX - half + 1, fromY);
        ctx.lineTo(toX - half + 1, toY);
      } else {
        // Horizontal pipe - highlight on top
        ctx.moveTo(fromX, fromY - half + 1);
        ctx.lineTo(toX, toY - half + 1);
      }
      ctx.stroke();

      // 3D shadow (darker bottom/right edge)
      ctx.strokeStyle = darkenColor(color, 60);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (fromX === toX) {
        // Vertical pipe - shadow on right
        ctx.moveTo(fromX + half - 1, fromY);
        ctx.lineTo(toX + half - 1, toY);
      } else {
        // Horizontal pipe - shadow on bottom
        ctx.moveTo(fromX, fromY + half - 1);
        ctx.lineTo(toX, toY + half - 1);
      }
      ctx.stroke();
    }

    function drawJoint(jx, jy, color) {
      // Rounded joint at elbows
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(jx, jy, PIPE_WIDTH / 2 + 1, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = lightenColor(color, 60);
      ctx.beginPath();
      ctx.arc(jx - 1, jy - 1, PIPE_WIDTH / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    function animate() {
      frameCount++;

      if (frameCount % FRAMES_PER_SEGMENT === 0) {
        const prevX = x;
        const prevY = y;
        const prevDir = dir;

        // Possibly turn
        if (Math.random() < TURN_CHANCE) {
          // Pick a perpendicular direction
          if (dir < 2) {
            // Was vertical, go horizontal
            dir = Math.random() < 0.5 ? 2 : 3;
          } else {
            // Was horizontal, go vertical
            dir = Math.random() < 0.5 ? 0 : 1;
          }
        }

        const d = DIRECTIONS[dir];
        x += d.dx * STEP_SIZE;
        y += d.dy * STEP_SIZE;
        segmentCount++;

        const color = PIPE_COLORS[colorIdx];

        // Check bounds or max segments
        if (
          x < 0 || x > canvas.width ||
          y < 0 || y > canvas.height ||
          segmentCount > MAX_SEGMENTS
        ) {
          startNewPipe();
        } else {
          // Draw joint if direction changed
          if (dir !== prevDir) {
            drawJoint(prevX, prevY, color);
          }
          drawPipeSegment(prevX, prevY, x, y, color);
        }

        // Random chance to start new pipe after enough segments
        if (segmentCount > MIN_SEGMENTS_BEFORE_NEW && Math.random() < 0.1) {
          startNewPipe();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  // Deactivation listeners
  useEffect(() => {
    if (!active) return;

    const deactivate = () => onDeactivate?.();

    window.addEventListener('mousemove', deactivate);
    window.addEventListener('mousedown', deactivate);
    window.addEventListener('keydown', deactivate);

    return () => {
      window.removeEventListener('mousemove', deactivate);
      window.removeEventListener('mousedown', deactivate);
      window.removeEventListener('keydown', deactivate);
    };
  }, [active, onDeactivate]);

  if (!active && !visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 99998,
      background: '#000',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease-in-out',
      pointerEvents: active ? 'auto' : 'none',
    }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

/* ── Color helpers ── */

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
