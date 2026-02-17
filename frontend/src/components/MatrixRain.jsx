import { useEffect, useRef } from 'react';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFNXTERMINAL';

export default function MatrixRain({ width, height, fontSize = 14, speed = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const cols = Math.ceil(width / fontSize);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const speeds = Array.from({ length: cols }, () => 0.5 + Math.random() * speed);
    const brightness = Array.from({ length: cols }, () => Math.random());

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    let animId;
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < cols; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const y = drops[i] * fontSize;

        // Head character (bright white-green)
        const headBright = 180 + Math.floor(brightness[i] * 75);
        ctx.fillStyle = `rgb(${headBright}, 255, ${headBright})`;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(char, i * fontSize, y);

        // Trail character slightly above (dimmer green)
        if (drops[i] > 1) {
          const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
          const dim = 50 + Math.floor(brightness[i] * 100);
          ctx.fillStyle = `rgb(0, ${dim}, 0)`;
          ctx.fillText(trailChar, i * fontSize, y - fontSize);
        }

        drops[i] += speeds[i];

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
          speeds[i] = 0.5 + Math.random() * speed;
          brightness[i] = Math.random();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [width, height, fontSize, speed]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
