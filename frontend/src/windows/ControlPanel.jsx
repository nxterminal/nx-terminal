import { useState, useEffect, useRef, useCallback } from 'react';

const WALLPAPERS = [
  { id: 'teal', name: 'Teal Classic', style: { background: '#008080' } },
  { id: 'corporate-blue', name: 'Corporate Blue', style: { background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)' } },
  { id: 'matrix', name: 'Matrix', style: { background: '#000000' }, hasAnimation: 'matrix' },
  { id: 'clouds', name: 'Clouds', style: { background: 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 40%, #b0d4f1 60%, #ffffff 100%)' } },
  { id: 'terminal', name: 'Terminal', style: { background: '#000000' }, hasAnimation: 'scanlines' },
];

const THEMES = [
  { id: 'classic', name: 'Classic', desc: 'The original Windows 98 look', preview: { bg: '#c0c0c0', titlebar: '#000080', text: '#000' } },
  { id: 'dark', name: 'Dark Mode', desc: 'Easy on the eyes. Hard on the soul.', preview: { bg: '#2d2d3f', titlebar: '#4a148c', text: '#e0e0e0' } },
  { id: 'high-contrast', name: 'High Contrast', desc: 'Maximum visibility. Maximum intensity.', preview: { bg: '#000000', titlebar: '#ffff00', text: '#ffffff' } },
];

const SCREENSAVERS = [
  { id: '3d-pipes', name: '3D Pipes' },
  { id: 'starfield', name: 'Starfield' },
];

function StarfieldPreview({ width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width - width / 2,
      y: Math.random() * height - height / 2,
      z: Math.random() * width,
    }));

    let animId;
    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      for (const star of stars) {
        star.z -= 2;
        if (star.z <= 0) {
          star.z = width;
          star.x = Math.random() * width - width / 2;
          star.y = Math.random() * height - height / 2;
        }
        const sx = (star.x / star.z) * (width / 2) + width / 2;
        const sy = (star.y / star.z) * (height / 2) + height / 2;
        const r = Math.max(0, (1 - star.z / width) * 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

function PipesPreview({ width, height }) {
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
      ctx.strokeStyle = colors[colorIdx % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);

      const len = Math.random() * 15 + 5;
      const dx = [len, 0, -len, 0][dir];
      const dy = [0, len, 0, -len][dir];
      x = Math.max(0, Math.min(width, x + dx));
      y = Math.max(0, Math.min(height, y + dy));

      ctx.lineTo(x, y);
      ctx.stroke();

      step++;
      if (step % 3 === 0) {
        dir = Math.floor(Math.random() * 4);
      }
      if (step % 12 === 0) {
        colorIdx++;
      }
      if (x <= 0 || x >= width || y <= 0 || y >= height) {
        x = Math.random() * width;
        y = Math.random() * height;
        colorIdx++;
      }

      animId = setTimeout(() => requestAnimationFrame(draw), 50);
    };
    draw();
    return () => { clearTimeout(animId); cancelAnimationFrame(animId); };
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

// Compress image to reduce localStorage size
function compressImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

export default function ControlPanel() {
  const [tab, setTab] = useState('wallpaper');
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('nx-wallpaper') || 'teal');
  const [customWallpaper, setCustomWallpaper] = useState(() => localStorage.getItem('nx-custom-wallpaper') || '');
  const [screensaver, setScreensaver] = useState(() => localStorage.getItem('nx-screensaver') || '3d-pipes');
  const [assistantEnabled, setAssistantEnabled] = useState(() => localStorage.getItem('nx-assistant-enabled') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('nx-theme') || 'classic');

  // Fake settings state (humor)
  const [morale, setMorale] = useState(23);
  const [synergy, setSynergy] = useState(47);

  const saveAndNotify = useCallback(() => {
    window.dispatchEvent(new Event('nx-settings-changed'));
  }, []);

  const handleWallpaperChange = (id) => {
    setWallpaper(id);
    localStorage.setItem('nx-wallpaper', id);
    if (id !== 'custom') {
      localStorage.removeItem('nx-custom-wallpaper');
      setCustomWallpaper('');
    }
    saveAndNotify();
  };

  const handleCustomWallpaper = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target.result;
      // Compress to fit localStorage (~5MB limit)
      const compressed = await compressImage(raw, 1920, 0.7);
      try {
        localStorage.setItem('nx-custom-wallpaper', compressed);
        setCustomWallpaper(compressed);
        setWallpaper('custom');
        localStorage.setItem('nx-wallpaper', 'custom');
        saveAndNotify();
      } catch (err) {
        // If still too large, compress more aggressively
        try {
          const smallerCompressed = await compressImage(raw, 1280, 0.5);
          localStorage.setItem('nx-custom-wallpaper', smallerCompressed);
          setCustomWallpaper(smallerCompressed);
          setWallpaper('custom');
          localStorage.setItem('nx-wallpaper', 'custom');
          saveAndNotify();
        } catch {
          alert('Image too large. Please try a smaller image.');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const removeCustomWallpaper = () => {
    setCustomWallpaper('');
    setWallpaper('teal');
    localStorage.setItem('nx-wallpaper', 'teal');
    localStorage.removeItem('nx-custom-wallpaper');
    saveAndNotify();
  };

  const handleScreensaverChange = (id) => {
    setScreensaver(id);
    localStorage.setItem('nx-screensaver', id);
  };

  const handleAssistantToggle = () => {
    const newVal = !assistantEnabled;
    setAssistantEnabled(newVal);
    localStorage.setItem('nx-assistant-enabled', newVal ? 'true' : 'false');
    saveAndNotify();
  };

  const handleThemeChange = (id) => {
    setTheme(id);
    localStorage.setItem('nx-theme', id);
    document.documentElement.setAttribute('data-theme', id);
    saveAndNotify();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button className={`win-tab${tab === 'wallpaper' ? ' active' : ''}`} onClick={() => setTab('wallpaper')}>Wallpaper</button>
        <button className={`win-tab${tab === 'theme' ? ' active' : ''}`} onClick={() => setTab('theme')}>Theme</button>
        <button className={`win-tab${tab === 'screensaver' ? ' active' : ''}`} onClick={() => setTab('screensaver')}>Screensaver</button>
        <button className={`win-tab${tab === 'assistant' ? ' active' : ''}`} onClick={() => setTab('assistant')}>NX Assistant</button>
        <button className={`win-tab${tab === 'corporate' ? ' active' : ''}`} onClick={() => setTab('corporate')}>Corporate</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'wallpaper' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px' }}>Select Wallpaper:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {WALLPAPERS.map(wp => (
                <div
                  key={wp.id}
                  className={`cp-wallpaper-option${wallpaper === wp.id ? ' selected' : ''}`}
                  onClick={() => handleWallpaperChange(wp.id)}
                >
                  <div className="cp-wallpaper-preview" style={wp.style}>
                    {wp.hasAnimation === 'matrix' && (
                      <div style={{ color: '#33ff33', fontSize: '6px', fontFamily: 'monospace', lineHeight: 1, overflow: 'hidden', height: '100%', opacity: 0.7 }}>
                        {'01001 10110 01101 11001 01010'.repeat(8)}
                      </div>
                    )}
                    {wp.hasAnimation === 'scanlines' && (
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>{wp.name}</div>
                </div>
              ))}

              <div
                className={`cp-wallpaper-option${wallpaper === 'custom' ? ' selected' : ''}`}
                onClick={() => document.getElementById('wp-upload').click()}
              >
                <div className="cp-wallpaper-preview" style={{
                  background: customWallpaper ? `url(${customWallpaper}) center/cover` : '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!customWallpaper && <span style={{ color: '#fff', fontSize: '18px' }}>+</span>}
                </div>
                <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>Custom</div>
              </div>
            </div>
            <input
              type="file"
              id="wp-upload"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              style={{ display: 'none' }}
              onChange={handleCustomWallpaper}
            />
            {customWallpaper && (
              <button className="win-btn" onClick={removeCustomWallpaper} style={{ marginTop: '8px', fontSize: '10px' }}>
                Remove custom wallpaper
              </button>
            )}
          </div>
        )}

        {tab === 'theme' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px' }}>Select Theme:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {THEMES.map(t => (
                <div
                  key={t.id}
                  className={theme === t.id ? 'win-panel' : 'win-raised'}
                  style={{
                    padding: '10px',
                    cursor: 'pointer',
                    border: theme === t.id ? '2px solid var(--terminal-green)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                  onClick={() => handleThemeChange(t.id)}
                >
                  {/* Mini preview */}
                  <div style={{
                    width: '80px', height: '50px',
                    background: t.preview.bg,
                    border: '1px solid var(--border-dark)',
                    position: 'relative',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {/* Mini titlebar */}
                    <div style={{
                      height: '8px',
                      background: t.preview.titlebar,
                      margin: '6px 8px 0 8px',
                    }} />
                    {/* Mini window body */}
                    <div style={{
                      height: '18px',
                      background: t.id === 'classic' ? '#c0c0c0' : t.id === 'dark' ? '#2d2d3f' : '#000',
                      margin: '0 8px',
                      border: `1px solid ${t.preview.text}33`,
                    }} />
                    {/* Mini taskbar */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '5px',
                      background: t.id === 'classic' ? '#c0c0c0' : t.id === 'dark' ? '#2d2d3f' : '#000',
                    }} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                      {t.name}
                      {theme === t.id && <span style={{ color: 'var(--terminal-green)', marginLeft: '8px', fontSize: '10px' }}>[ACTIVE]</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted, #999)', marginTop: '8px', fontStyle: 'italic' }}>
              Theme changes are applied immediately and persist across sessions.
            </div>
          </div>
        )}

        {tab === 'screensaver' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px' }}>Select Screensaver:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {SCREENSAVERS.map(ss => (
                <div
                  key={ss.id}
                  className={`cp-screensaver-option${screensaver === ss.id ? ' selected' : ''}`}
                  onClick={() => handleScreensaverChange(ss.id)}
                >
                  <div className="cp-screensaver-preview">
                    {ss.id === 'starfield' ? (
                      <StarfieldPreview width={160} height={100} />
                    ) : (
                      <PipesPreview width={160} height={100} />
                    )}
                  </div>
                  <div style={{ fontSize: '11px', textAlign: 'center', marginTop: '4px', fontWeight: 'bold' }}>{ss.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'assistant' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px' }}>NX Assistant (Clippy)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px' }}>
              <div
                className={`cp-toggle${assistantEnabled ? ' on' : ''}`}
                onClick={handleAssistantToggle}
              >
                <div className="cp-toggle-knob" />
              </div>
              <span style={{ fontSize: '11px' }}>
                {assistantEnabled ? 'Enabled — Your helpful corporate assistant is active' : 'Disabled — The robot sleeps'}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#666', padding: '8px', marginTop: '4px' }}>
              The NX Assistant appears periodically with helpful (useless) tips and observations.
              Disabling it will not affect your performance review. Probably.
            </div>
          </div>
        )}

        {tab === 'corporate' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '11px' }}>Corporate Settings</div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#444', marginBottom: '4px' }}>
                CORPORATE MORALE INDEX: {morale}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={morale}
                onChange={(e) => setMorale(Number(e.target.value))}
                style={{ width: '200px' }}
              />
              <div style={{ fontSize: '9px', color: '#999' }}>
                (This slider does absolutely nothing)
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#444', marginBottom: '4px' }}>
                SYNERGY LEVEL: {synergy}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={synergy}
                onChange={(e) => setSynergy(Number(e.target.value))}
                style={{ width: '200px' }}
              />
              <div style={{ fontSize: '9px', color: '#999' }}>
                (Adjusting synergy has no measurable impact on anything)
              </div>
            </div>

            <div className="win-panel" style={{ padding: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>CORPORATE DISCLAIMER</div>
              <div style={{ fontSize: '9px', color: '#666' }}>
                NX Terminal Corp. is not responsible for any loss of motivation, productivity, or will to live
                that may result from adjusting these settings. All complaints will be forwarded to /dev/null.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
