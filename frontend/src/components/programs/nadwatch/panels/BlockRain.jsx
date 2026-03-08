import { useRef, useEffect } from 'react';
import { RAIN_CHARS, RAIN_FONT_SIZE, COLORS, MONANIMAL_WORDS } from '../constants';
import Tooltip from '../components/Tooltip';

export default function BlockRain({ blockNumber }) {
  const canvasRef = useRef(null);
  const columnsRef = useRef([]);
  const lastFrameRef = useRef(0);
  const flashRef = useRef(0);
  const blockTextRef = useRef('');
  const blockTextAlphaRef = useRef(0);
  const prevBlockRef = useRef(0);
  // Monanimal easter egg state
  const easterEggRef = useRef({
    active: false,
    word: '',
    colIndex: 0,
    charIndex: 0,
    nextTrigger: Date.now() + 12000 + Math.random() * 6000,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;

      const colWidth = RAIN_FONT_SIZE * 0.65;
      const colCount = Math.floor(canvas.width / colWidth);
      const cols = [];
      for (let i = 0; i < colCount; i++) {
        cols.push({
          x: i * colWidth,
          y: Math.random() * canvas.height,
          speed: 1 + Math.random() * 3,
          isPurple: Math.random() < 0.3, // 30% purple columns
        });
      }
      columnsRef.current = cols;
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (blockNumber > 0 && blockNumber !== prevBlockRef.current) {
      prevBlockRef.current = blockNumber;
      flashRef.current = 1.0;
      blockTextRef.current = `▓▓ BLOCK #${blockNumber.toLocaleString()} CONFIRMED — 400ms ▓▓`;
      blockTextAlphaRef.current = 1.0;
    }
  }, [blockNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const draw = (timestamp) => {
      animId = requestAnimationFrame(draw);

      // Throttle to ~20fps
      if (timestamp - lastFrameRef.current < 50) return;
      lastFrameRef.current = timestamp;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, w, h);

      const fontSize = RAIN_FONT_SIZE;
      ctx.font = `${fontSize}px "Courier New", monospace`;

      const columns = columnsRef.current;

      // Monanimal easter egg logic
      const egg = easterEggRef.current;
      const now = Date.now();
      if (!egg.active && now >= egg.nextTrigger && columns.length > 0) {
        egg.active = true;
        egg.word = MONANIMAL_WORDS[Math.floor(Math.random() * MONANIMAL_WORDS.length)];
        egg.colIndex = Math.floor(Math.random() * columns.length);
        egg.charIndex = 0;
      }

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        let char;
        let isEasterEgg = false;

        // Check if this column is showing an easter egg character
        if (egg.active && i === egg.colIndex && egg.charIndex < egg.word.length) {
          char = egg.word[egg.charIndex];
          egg.charIndex++;
          isEasterEgg = true;
          if (egg.charIndex >= egg.word.length) {
            egg.active = false;
            egg.nextTrigger = now + 12000 + Math.random() * 6000;
          }
        } else {
          char = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
        }

        if (isEasterEgg) {
          ctx.fillStyle = '#BF7FFF';
          ctx.shadowColor = '#BF7FFF';
          ctx.shadowBlur = 15;
        } else {
          const isBright = Math.random() < 0.05;
          if (isBright) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = col.isPurple ? COLORS.primary : COLORS.green;
            ctx.shadowBlur = 8;
          } else if (col.isPurple) {
            const opacity = 0.15 + Math.random() * 0.35;
            ctx.fillStyle = `rgba(155, 89, 182, ${opacity})`;
            ctx.shadowBlur = 0;
          } else {
            const opacity = 0.15 + Math.random() * 0.35;
            ctx.fillStyle = `rgba(48, 255, 96, ${opacity})`;
            ctx.shadowBlur = 0;
          }
        }

        ctx.fillText(char, col.x, col.y);
        ctx.shadowBlur = 0;

        col.y += col.speed * fontSize * 0.6;

        if (col.y > h + fontSize) {
          col.y = -fontSize;
          col.speed = 1 + Math.random() * 3;
        }
      }

      // Purple radial flash on new block
      if (flashRef.current > 0) {
        const flashY = (1 - flashRef.current) * h;
        ctx.save();
        ctx.fillStyle = `rgba(123, 47, 190, ${flashRef.current * 0.12})`;
        ctx.fillRect(0, flashY - 2, w, 4);
        ctx.restore();
        flashRef.current = Math.max(0, flashRef.current - 0.08);
      }

      // Block confirmation text
      if (blockTextAlphaRef.current > 0) {
        ctx.save();
        ctx.font = 'bold 13px "VT323", "Courier New", monospace';
        ctx.textAlign = 'center';

        const textMetrics = ctx.measureText(blockTextRef.current);
        const bgPadX = 10;
        const bgPadY = 4;
        const bgX = w / 2 - textMetrics.width / 2 - bgPadX;
        const bgY = h - 16 - 10 - bgPadY;
        const bgW = textMetrics.width + bgPadX * 2;
        const bgH = 14 + bgPadY * 2;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * blockTextAlphaRef.current})`;
        ctx.fillRect(bgX, bgY, bgW, bgH);

        const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
        const r = Math.round(123 * (1 - pulse) + 190 * pulse);
        const g = Math.round(47 + pulse * 30);
        const b = Math.round(190 + pulse * 65);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${blockTextAlphaRef.current})`;
        ctx.shadowColor = COLORS.primary;
        ctx.shadowBlur = 3;
        ctx.fillText(blockTextRef.current, w / 2, h - 16);
        ctx.restore();

        blockTextAlphaRef.current = Math.max(0, blockTextAlphaRef.current - 0.008);
      }

      // "MONAD FEED — LIVE" label
      ctx.save();
      ctx.font = '9px "Courier New", monospace';
      ctx.fillStyle = 'rgba(123, 47, 190, 0.7)';
      ctx.textAlign = 'left';
      ctx.fillText('MONAD FEED \u2014 LIVE', 6, 14);
      ctx.restore();
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <Tooltip
        text="Block Rain — Real-time visualization of Monad blockchain activity. Purple/green bicolor columns with Monanimal easter eggs."
        style={{ position: 'absolute', top: '2px', left: '2px', width: '140px', height: '18px', zIndex: 2 }}
      >
        <div style={{ width: '100%', height: '100%', cursor: 'default' }} />
      </Tooltip>
      <div className="ndw-scanlines" />
    </div>
  );
}
