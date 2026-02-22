import { useEffect, useRef } from 'react';
import MatrixRain from './MatrixRain';

function Starfield({ width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random() * width - width / 2,
      y: Math.random() * height - height / 2,
      z: Math.random() * width,
    }));

    let animId;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, width, height);
      for (const star of stars) {
        star.z -= 3;
        if (star.z <= 0) {
          star.z = width;
          star.x = Math.random() * width - width / 2;
          star.y = Math.random() * height - height / 2;
        }
        const sx = (star.x / star.z) * (width / 2) + width / 2;
        const sy = (star.y / star.z) * (height / 2) + height / 2;
        const r = Math.max(0.5, (1 - star.z / width) * 3);
        const brightness = Math.min(255, Math.floor((1 - star.z / width) * 255));
        ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    draw();
    return () => cancelAnimationFrame(animId);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

function Pipes({ width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = ['#ff4444', '#33ff33', '#4488ff', '#ffd700', '#ff44ff', '#00ffff'];
    let x = width / 2, y = height / 2;
    let dir = 0;
    let colorIdx = 0;
    let step = 0;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    let animId;
    const draw = () => {
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = colors[colorIdx % colors.length];
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x, y);

        const len = Math.random() * 70 + 30;
        const dx = [len, 0, -len, 0][dir];
        const dy = [0, len, 0, -len][dir];
        x = Math.max(0, Math.min(width, x + dx));
        y = Math.max(0, Math.min(height, y + dy));

        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = colors[colorIdx % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        step++;
        if (step % 3 === 0) dir = Math.floor(Math.random() * 4);
        if (step % 15 === 0) colorIdx++;
        if (x <= 0 || x >= width || y <= 0 || y >= height) {
          x = Math.random() * width;
          y = Math.random() * height;
          colorIdx++;
        }
      }
      animId = setTimeout(() => requestAnimationFrame(draw), 30);
    };
    draw();
    return () => { clearTimeout(animId); cancelAnimationFrame(animId); };
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

export default function Screensaver({ onDismiss }) {
  const type = localStorage.getItem('nx-screensaver') || '3d-pipes';

  useEffect(() => {
    const dismiss = () => { if (onDismiss) onDismiss(); };
    const timer = setTimeout(() => {
      window.addEventListener('mousemove', dismiss);
      window.addEventListener('keydown', dismiss);
      window.addEventListener('mousedown', dismiss);
    }, 300);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', dismiss);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('mousedown', dismiss);
    };
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: '#000',
      zIndex: 99998,
      cursor: 'none',
    }}>
      {type === 'starfield' ? (
        <Starfield width={window.innerWidth} height={window.innerHeight} />
      ) : type === 'matrix' ? (
        <MatrixRain width={window.innerWidth} height={window.innerHeight} fontSize={16} speed={0.3} />
      ) : (
        <Pipes width={window.innerWidth} height={window.innerHeight} />
      )}
    </div>
  );
}
