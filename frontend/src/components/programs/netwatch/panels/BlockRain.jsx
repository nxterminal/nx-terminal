import { useRef, useEffect } from 'react';
import { VISUAL } from '../utils/constants';
import Tooltip from '../components/Tooltip';

export default function BlockRain({ blockNumber }) {
  const canvasRef = useRef(null);
  const columnsRef = useRef([]);
  const lastFrameRef = useRef(0);
  const flashRef = useRef(0);
  const blockTextRef = useRef('');
  const blockTextAlphaRef = useRef(0);
  const prevBlockRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;

      const colWidth = VISUAL.RAIN_FONT_SIZE * 0.65;
      const colCount = Math.floor(canvas.width / colWidth);
      const cols = [];
      for (let i = 0; i < colCount; i++) {
        cols.push({
          x: i * colWidth,
          y: Math.random() * canvas.height,
          speed: 1 + Math.random() * 3,
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
      blockTextRef.current = `\u2593 BLOCK #${blockNumber.toLocaleString()} CONFIRMED \u2593`;
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

      if (timestamp - lastFrameRef.current < 50) return;
      lastFrameRef.current = timestamp;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, w, h);

      const fontSize = VISUAL.RAIN_FONT_SIZE;
      ctx.font = `${fontSize}px "Courier New", monospace`;

      const columns = columnsRef.current;
      const chars = VISUAL.RAIN_CHARS;

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const char = chars[Math.floor(Math.random() * chars.length)];

        const isWhite = Math.random() < 0.05;
        if (isWhite) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = VISUAL.GREEN;
          ctx.shadowBlur = 8;
        } else {
          const opacity = 0.15 + Math.random() * 0.35;
          ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
          ctx.shadowBlur = 0;
        }

        ctx.fillText(char, col.x, col.y);
        ctx.shadowBlur = 0;

        col.y += col.speed * fontSize * 0.6;

        if (col.y > h + fontSize) {
          col.y = -fontSize;
          col.speed = 1 + Math.random() * 3;
        }
      }

      if (flashRef.current > 0) {
        const flashY = (1 - flashRef.current) * h;
        ctx.save();
        ctx.fillStyle = `rgba(0, 255, 255, ${flashRef.current * 0.3})`;
        ctx.fillRect(0, flashY - 2, w, 4);
        ctx.restore();
        flashRef.current = Math.max(0, flashRef.current - 0.08);
      }

      if (blockTextAlphaRef.current > 0) {
        ctx.save();
        ctx.font = 'bold 13px "VT323", "Courier New", monospace';
        ctx.textAlign = 'center';

        // Semi-transparent background behind text for legibility
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
        const g = 255;
        const b = Math.round(65 * (1 - pulse) + 255 * pulse);

        ctx.fillStyle = `rgba(0, ${g}, ${b}, ${blockTextAlphaRef.current})`;
        ctx.shadowColor = VISUAL.CYAN;
        ctx.shadowBlur = 3;
        ctx.fillText(blockTextRef.current, w / 2, h - 16);
        ctx.restore();

        blockTextAlphaRef.current = Math.max(0, blockTextAlphaRef.current - 0.008);
      }

      ctx.save();
      ctx.font = '9px "Courier New", monospace';
      ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
      ctx.textAlign = 'left';
      ctx.fillText('BLOCK FEED \u2014 LIVE', 6, 14);
      ctx.restore();
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="nw-rain-panel" style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {/* Invisible overlay for tooltip on "BLOCK FEED — LIVE" label */}
      <Tooltip
        text="Block Rain \u2014 Real-time visualization of MegaETH blockchain activity. Characters flash cyan when a new block is confirmed."
        style={{ position: 'absolute', top: '2px', left: '2px', width: '140px', height: '18px', zIndex: 2 }}
      >
        <div style={{ width: '100%', height: '100%', cursor: 'default' }} />
      </Tooltip>
      <div className="nw-scanlines" />
    </div>
  );
}
