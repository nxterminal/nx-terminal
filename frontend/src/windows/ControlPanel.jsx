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
  { id: 'matrix', name: 'Matrix Rain' },
];

const TIMEOUT_OPTIONS = [
  { value: 60000, label: '1 minute' },
  { value: 120000, label: '2 minutes' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 900000, label: '15 minutes' },
];

const AGENT_LIST = ['Clippy', 'Merlin', 'Rover', 'Links', 'Peedy', 'Genius', 'F1'];
const AGENT_CDN = 'https://cdn.jsdelivr.net/gh/smore-inc/clippy.js@master/agents';

// Frame sizes for each agent sprite sheet (width x height of a single frame)
const AGENT_FRAME = {
  Clippy: [124, 93],
  Merlin: [124, 126],
  Rover: [128, 100],
  Links: [124, 110],
  Peedy: [124, 113],
  Genius: [124, 93],
  F1: [124, 93],
};

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
      if (step % 3 === 0) dir = Math.floor(Math.random() * 4);
      if (step % 12 === 0) colorIdx++;
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

function MatrixPreview({ width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chars = 'アイウエオ01NX';
    const fontSize = 8;
    const cols = Math.ceil(width / fontSize);
    const drops = Array.from({ length: cols }, () => Math.random() * -10);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    let animId;
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < cols; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = `rgb(0, ${150 + Math.floor(Math.random() * 105)}, 0)`;
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        drops[i] += 0.5 + Math.random() * 0.5;
        if (drops[i] * fontSize > height && Math.random() > 0.975) drops[i] = 0;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

function AgentPreview({ name, selected, onClick }) {
  const canvasRef = useRef(null);
  const [fw, fh] = AGENT_FRAME[name] || [124, 93];

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      // Scale first frame to fit 64x64 centered
      const scale = Math.min(64 / fw, 64 / fh);
      const dw = fw * scale;
      const dh = fh * scale;
      const dx = (64 - dw) / 2;
      const dy = (64 - dh) / 2;
      // Extract first frame (0,0,fw,fh) from sprite sheet and draw scaled
      ctx.drawImage(img, 0, 0, fw, fh, dx, dy, dw, dh);
    };
    img.src = `${AGENT_CDN}/${name}/map.png`;
  }, [name, fw, fh]);

  return (
    <div
      className={selected ? 'win-panel' : 'win-raised'}
      style={{
        padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
        border: selected ? '2px solid var(--terminal-green, #33ff33)' : '2px solid transparent',
        fontSize: '10px', fontWeight: selected ? 'bold' : 'normal',
      }}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        width={64}
        height={64}
        style={{ display: 'block', margin: '0 auto 4px' }}
      />
      {name}
    </div>
  );
}

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

  // Saved (applied) values
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('nx-wallpaper') || 'teal');
  const [customWallpaper, setCustomWallpaper] = useState(() => localStorage.getItem('nx-custom-wallpaper') || '');
  const [screensaver, setScreensaver] = useState(() => localStorage.getItem('nx-screensaver') || '3d-pipes');
  const [screensaverTimeout, setScreensaverTimeout] = useState(() => {
    return parseInt(localStorage.getItem('nx-screensaver-timeout')) || 60000;
  });
  const [assistantEnabled, setAssistantEnabled] = useState(() => localStorage.getItem('nx-assistant-enabled') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('nx-theme') || 'classic');
  const [assistantAgent, setAssistantAgent] = useState(() => localStorage.getItem('nx-assistant-agent') || 'Clippy');

  // Pending (selected but not yet applied) values
  const [pendingWallpaper, setPendingWallpaper] = useState(null);
  const [pendingScreensaver, setPendingScreensaver] = useState(null);
  const [pendingTimeout, setPendingTimeout] = useState(null);
  const [pendingAgent, setPendingAgent] = useState(null);

  // Screensaver preview state
  const [showingPreview, setShowingPreview] = useState(false);

  const [morale, setMorale] = useState(23);
  const [synergy, setSynergy] = useState(47);

  const saveAndNotify = useCallback(() => {
    window.dispatchEvent(new Event('nx-settings-changed'));
  }, []);

  // ── Apply functions (called on OK/Apply) ──
  const applyWallpaper = () => {
    const id = pendingWallpaper || wallpaper;
    setWallpaper(id);
    localStorage.setItem('nx-wallpaper', id);
    if (id !== 'custom') {
      localStorage.removeItem('nx-custom-wallpaper');
      setCustomWallpaper('');
    }
    setPendingWallpaper(null);
    saveAndNotify();
  };

  const applyScreensaver = () => {
    const id = pendingScreensaver || screensaver;
    const timeout = pendingTimeout || screensaverTimeout;
    setScreensaver(id);
    setScreensaverTimeout(timeout);
    localStorage.setItem('nx-screensaver', id);
    localStorage.setItem('nx-screensaver-timeout', String(timeout));
    setPendingScreensaver(null);
    setPendingTimeout(null);
    window.dispatchEvent(new Event('nx-screensaver-changed'));
  };

  const applyAssistant = () => {
    const name = pendingAgent || assistantAgent;
    setAssistantAgent(name);
    localStorage.setItem('nx-assistant-agent', name);
    setPendingAgent(null);
    window.dispatchEvent(new Event('nx-assistant-changed'));
  };

  const handleCustomWallpaper = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target.result;
      const compressed = await compressImage(raw, 1920, 0.7);
      try {
        localStorage.setItem('nx-custom-wallpaper', compressed);
        setCustomWallpaper(compressed);
        setWallpaper('custom');
        localStorage.setItem('nx-wallpaper', 'custom');
        setPendingWallpaper(null);
        saveAndNotify();
      } catch {
        try {
          const smallerCompressed = await compressImage(raw, 1280, 0.5);
          localStorage.setItem('nx-custom-wallpaper', smallerCompressed);
          setCustomWallpaper(smallerCompressed);
          setWallpaper('custom');
          localStorage.setItem('nx-wallpaper', 'custom');
          setPendingWallpaper(null);
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
    setPendingWallpaper(null);
    saveAndNotify();
  };

  const handleAssistantToggle = () => {
    const newVal = !assistantEnabled;
    setAssistantEnabled(newVal);
    localStorage.setItem('nx-assistant-enabled', newVal ? 'true' : 'false');
    window.dispatchEvent(new Event('nx-assistant-changed'));
  };

  const handleThemeChange = (id) => {
    setTheme(id);
    localStorage.setItem('nx-theme', id);
    document.documentElement.setAttribute('data-theme', id);
    saveAndNotify();
  };

  const handlePreviewScreensaver = () => {
    setShowingPreview(true);
  };

  // Dismiss preview on any user input
  useEffect(() => {
    if (!showingPreview) return;
    const dismiss = () => setShowingPreview(false);
    const timer = setTimeout(() => {
      window.addEventListener('mousemove', dismiss);
      window.addEventListener('keydown', dismiss);
      window.addEventListener('mousedown', dismiss);
    }, 500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', dismiss);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('mousedown', dismiss);
    };
  }, [showingPreview]);

  const activeWallpaper = pendingWallpaper || wallpaper;
  const activeScreensaver = pendingScreensaver || screensaver;
  const activeTimeout = pendingTimeout || screensaverTimeout;
  const activeAgent = pendingAgent || assistantAgent;
  const hasScreensaverChanges = pendingScreensaver !== null || pendingTimeout !== null;

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
                  className={`cp-wallpaper-option${activeWallpaper === wp.id ? ' selected' : ''}`}
                  onClick={() => setPendingWallpaper(wp.id)}
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
                className={`cp-wallpaper-option${activeWallpaper === 'custom' ? ' selected' : ''}`}
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
              type="file" id="wp-upload" accept=".jpg,.jpeg,.png,.gif,.webp"
              style={{ display: 'none' }} onChange={handleCustomWallpaper}
            />
            {customWallpaper && (
              <button className="win-btn" onClick={removeCustomWallpaper} style={{ marginTop: '8px', fontSize: '10px' }}>
                Remove custom wallpaper
              </button>
            )}
            <div style={{ textAlign: 'right', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '8px' }}>
              <button className="win-btn" onClick={applyWallpaper} disabled={!pendingWallpaper} style={{ padding: '4px 24px', fontWeight: 'bold', fontSize: '11px' }}>
                Apply
              </button>
            </div>
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
                    padding: '10px', cursor: 'pointer',
                    border: theme === t.id ? '2px solid var(--terminal-green)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                  onClick={() => handleThemeChange(t.id)}
                >
                  <div style={{
                    width: '80px', height: '50px', background: t.preview.bg,
                    border: '1px solid var(--border-dark)', position: 'relative', flexShrink: 0, overflow: 'hidden',
                  }}>
                    <div style={{ height: '8px', background: t.preview.titlebar, margin: '6px 8px 0 8px' }} />
                    <div style={{
                      height: '18px', background: t.id === 'classic' ? '#c0c0c0' : t.id === 'dark' ? '#2d2d3f' : '#000',
                      margin: '0 8px', border: `1px solid ${t.preview.text}33`,
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '5px',
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

            {/* Preview monitor */}
            <div className="win-panel" style={{
              width: '200px', height: '130px', margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', background: '#000',
            }}>
              {activeScreensaver === 'starfield' ? (
                <StarfieldPreview width={200} height={130} />
              ) : activeScreensaver === 'matrix' ? (
                <MatrixPreview width={200} height={130} />
              ) : (
                <PipesPreview width={200} height={130} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {SCREENSAVERS.map(ss => (
                <div
                  key={ss.id}
                  className={activeScreensaver === ss.id ? 'win-panel' : 'win-raised'}
                  style={{
                    padding: '8px', textAlign: 'center', cursor: 'pointer',
                    border: activeScreensaver === ss.id ? '2px solid var(--terminal-green, #33ff33)' : '2px solid transparent',
                  }}
                  onClick={() => setPendingScreensaver(ss.id)}
                >
                  <div style={{ fontSize: '11px', fontWeight: activeScreensaver === ss.id ? 'bold' : 'normal' }}>{ss.name}</div>
                </div>
              ))}
            </div>

            {/* Timeout setting */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Wait:</span>
              <select
                value={activeTimeout}
                onChange={(e) => setPendingTimeout(Number(e.target.value))}
                style={{
                  fontSize: '11px', padding: '2px 4px',
                  background: 'var(--bg-primary, #fff)',
                  border: '1px solid var(--border-dark, #808080)',
                }}
              >
                {TIMEOUT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>before activating</span>
            </div>

            {/* Preview + Apply */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '8px' }}>
              <button className="win-btn" onClick={handlePreviewScreensaver} style={{ padding: '4px 16px', fontSize: '11px' }}>
                Preview
              </button>
              <button className="win-btn" onClick={applyScreensaver} disabled={!hasScreensaverChanges} style={{ padding: '4px 24px', fontWeight: 'bold', fontSize: '11px' }}>
                Apply
              </button>
            </div>
          </div>
        )}

        {tab === 'assistant' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px' }}>NX Assistant</div>
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

            {assistantEnabled && (
              <div style={{ padding: '8px', marginTop: '4px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '8px' }}>Choose Your Assistant:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {AGENT_LIST.map(name => (
                    <AgentPreview
                      key={name}
                      name={name}
                      selected={activeAgent === name}
                      onClick={() => setPendingAgent(name)}
                    />
                  ))}
                </div>
                <div style={{ textAlign: 'right', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '8px' }}>
                  <button className="win-btn" onClick={applyAssistant} disabled={!pendingAgent} style={{ padding: '4px 24px', fontWeight: 'bold', fontSize: '11px' }}>
                    Apply
                  </button>
                </div>
              </div>
            )}

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
                type="range" min="0" max="100" value={morale}
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
                type="range" min="0" max="100" value={synergy}
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

      {/* Full-screen screensaver preview overlay */}
      {showingPreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#000', zIndex: 99999, cursor: 'none',
        }}>
          {activeScreensaver === 'starfield' ? (
            <StarfieldPreview width={window.innerWidth} height={window.innerHeight} />
          ) : activeScreensaver === 'matrix' ? (
            <MatrixPreview width={window.innerWidth} height={window.innerHeight} />
          ) : (
            <PipesPreview width={window.innerWidth} height={window.innerHeight} />
          )}
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            color: '#666', fontSize: '12px', fontFamily: 'monospace',
          }}>
            Move mouse or press any key to exit preview
          </div>
        </div>
      )}
    </div>
  );
}
