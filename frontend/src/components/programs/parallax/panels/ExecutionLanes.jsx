import { useRef, useEffect } from 'react';
import { LANE_COLORS, CANVAS_FRAME_MS, COLORS } from '../constants';
import Tooltip from '../components/Tooltip';

const LABEL_WIDTH = 36;
const SERIAL_WIDTH = 72;
const HEADER_HEIGHT = 20;

export default function ExecutionLanes({ lanes, events }) {
  const canvasRef = useRef(null);
  const lastFrameRef = useRef(0);
  const lanesRef = useRef(lanes);
  const flashRef = useRef(0);

  // Keep latest lanes in ref for animation loop
  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  // Flash on new conflict events
  useEffect(() => {
    if (events.length > 0 && events[events.length - 1].type === 'CONFLICT') {
      flashRef.current = 1.0;
    }
  }, [events]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const draw = (timestamp) => {
      animId = requestAnimationFrame(draw);

      if (timestamp - lastFrameRef.current < CANVAS_FRAME_MS) return;
      lastFrameRef.current = timestamp;

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      const currentLanes = lanesRef.current;
      const laneAreaW = w - LABEL_WIDTH - SERIAL_WIDTH;
      const laneH = (h - HEADER_HEIGHT) / 8;

      // Clear
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Header
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'left';
      ctx.fillText('EXECUTION LANES \u2014 OPTIMISTIC PARALLEL', LABEL_WIDTH + 4, 14);

      // SERIAL ORDER header
      ctx.fillStyle = '#666';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SERIAL', w - SERIAL_WIDTH / 2, 10);
      ctx.fillText('ORDER', w - SERIAL_WIDTH / 2, 18);

      // Serial column background
      ctx.fillStyle = '#111';
      ctx.fillRect(w - SERIAL_WIDTH, HEADER_HEIGHT, SERIAL_WIDTH, h - HEADER_HEIGHT);
      ctx.strokeStyle = 'rgba(123,47,190,0.2)';
      ctx.beginPath();
      ctx.moveTo(w - SERIAL_WIDTH, HEADER_HEIGHT);
      ctx.lineTo(w - SERIAL_WIDTH, h);
      ctx.stroke();

      // Draw each lane
      for (let i = 0; i < 8; i++) {
        const lane = currentLanes[i] || { transactions: [], utilization: 0 };
        const y = HEADER_HEIGHT + i * laneH;

        // Lane background (alternating)
        ctx.fillStyle = i % 2 === 0 ? '#0d0d0d' : '#111111';
        ctx.fillRect(LABEL_WIDTH, y, laneAreaW, laneH);

        // Lane separator
        ctx.strokeStyle = 'rgba(123,47,190,0.12)';
        ctx.beginPath();
        ctx.moveTo(LABEL_WIDTH, y);
        ctx.lineTo(w - SERIAL_WIDTH, y);
        ctx.stroke();

        // Lane label
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillStyle = LANE_COLORS[i];
        ctx.textAlign = 'center';
        ctx.fillText(`L${i}`, LABEL_WIDTH / 2, y + laneH / 2 + 4);

        // Utilization mini-bar next to label
        const utilH = lane.utilization * (laneH - 6);
        if (utilH > 0) {
          ctx.fillStyle = LANE_COLORS[i];
          ctx.globalAlpha = 0.25;
          ctx.fillRect(LABEL_WIDTH - 6, y + laneH - utilH - 3, 4, utilH);
          ctx.globalAlpha = 1;
        }

        // Draw transactions
        const txs = lane.transactions.slice(-15); // cap visible
        for (let j = 0; j < txs.length; j++) {
          const tx = txs[j];
          const txW = Math.max(8, Math.min(60, (tx.gas / 500000) * 50));
          const txX = LABEL_WIDTH + tx.progress * (laneAreaW - txW - 4) + 2;
          const txY = y + 3;
          const txH = laneH - 6;

          ctx.save();

          if (tx.state === 'conflict') {
            ctx.fillStyle = '#FF3333';
            ctx.shadowColor = '#FF3333';
            ctx.shadowBlur = 8;

            // Draw conflict connector line
            if (tx.conflictWith !== null && tx.conflictWith !== i) {
              const conflictY = HEADER_HEIGHT + tx.conflictWith * laneH + laneH / 2;
              ctx.save();
              ctx.strokeStyle = 'rgba(255,51,51,0.5)';
              ctx.setLineDash([3, 3]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(txX + txW / 2, y + laneH / 2);
              ctx.lineTo(txX + txW / 2, conflictY);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          } else if (tx.state === 'reexecuting') {
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 4;
          } else if (tx.state === 'done') {
            ctx.fillStyle = LANE_COLORS[i];
            ctx.globalAlpha = 0.3;
          } else if (tx.state === 'executing') {
            ctx.fillStyle = LANE_COLORS[i];
            ctx.globalAlpha = 0.4 + tx.progress * 0.6;
          } else {
            // pending
            ctx.fillStyle = LANE_COLORS[i];
            ctx.globalAlpha = 0.15;
          }

          ctx.fillRect(txX, txY, txW, txH);
          ctx.restore();
        }

        // Serial order column — show tx count for this lane
        ctx.font = '9px "Courier New", monospace';
        ctx.fillStyle = LANE_COLORS[i];
        ctx.globalAlpha = 0.7;
        ctx.textAlign = 'center';
        const txCount = lane.transactions.length;
        const doneCount = lane.transactions.filter(t => t.state === 'done').length;
        ctx.fillText(`${doneCount}/${txCount}`, w - SERIAL_WIDTH / 2, y + laneH / 2 + 3);
        ctx.globalAlpha = 1;
      }

      // Bottom lane separator
      ctx.strokeStyle = 'rgba(123,47,190,0.12)';
      ctx.beginPath();
      ctx.moveTo(LABEL_WIDTH, h);
      ctx.lineTo(w - SERIAL_WIDTH, h);
      ctx.stroke();

      // Red flash on conflict
      if (flashRef.current > 0) {
        ctx.fillStyle = `rgba(255, 51, 51, ${flashRef.current * 0.06})`;
        ctx.fillRect(0, 0, w, h);
        flashRef.current = Math.max(0, flashRef.current - 0.06);
      }
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0a', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <Tooltip
        text="Execution Lanes \u2014 8 parallel lanes processing transactions simultaneously. Conflicts shown in red with dashed connector lines."
        style={{ position: 'absolute', top: '2px', left: '38px', width: '180px', height: '16px', zIndex: 2 }}
      >
        <div style={{ width: '100%', height: '100%', cursor: 'default' }} />
      </Tooltip>
      <div className="plx-scanlines" />
    </div>
  );
}
