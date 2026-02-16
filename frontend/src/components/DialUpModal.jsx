import { useState, useEffect } from 'react';

export default function DialUpModal({ onComplete, onClose }) {
  const [phase, setPhase] = useState('dialing');
  const [dialText, setDialText] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const seq = [
      ['Initializing modem...', 500],
      ['ATZ', 300],
      ['OK', 200],
      ['ATDT *67 1-800-NXT-MINT', 600],
      ['DIALING...', 800],
      ['>>> bzzzzzzKKKKRRRRRRRsshhhhhh <<<', 1200],
      ['>>> KRRRRRRR-EEEEEE-GRRRRRR <<<', 1000],
      ['CONNECT 56000', 400],
      ['Verifying credentials...', 600],
      ['Authentication successful.', 400],
    ];
    let timeout;
    let idx = 0;
    let acc = '';
    const run = () => {
      if (idx < seq.length) {
        acc += (acc ? '\n' : '') + seq[idx][0];
        setDialText(acc);
        timeout = setTimeout(() => { idx++; run(); }, seq[idx][1]);
      } else {
        setPhase('downloading');
      }
    };
    run();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (phase !== 'downloading') return;
    const id = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(id); setPhase('complete'); return 100; }
        const inc = Math.random() < 0.1 ? 0 : Math.random() < 0.3 ? 1 : Math.floor(Math.random() * 5) + 1;
        return Math.min(100, prev + inc);
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'complete') {
      const t = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const files = [
    { name: 'dev_personality.dll', size: '128 KB' },
    { name: 'neural_weights.bin', size: '2,048 KB' },
    { name: 'archetype_core.sys', size: '512 KB' },
    { name: 'employment_contract.pdf', size: '64 KB' },
  ];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--win-bg)', width: 440, boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 var(--border-light), inset -2px -2px 0 var(--border-dark), inset 2px 2px 0 #dfdfdf' }}>
        <div style={{ background: 'linear-gradient(90deg, var(--win-title-l), var(--win-title-r))', color: '#fff', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold', height: 22 }}>
          <span>📞 NX Terminal Dial-Up Connection</span>
          <button className="win98-titlebar-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 12 }}>
          {phase === 'dialing' && (
            <div style={{ background: '#000', padding: 8, minHeight: 160, maxHeight: 200, overflow: 'auto' }}>
              <pre style={{ margin: 0, fontSize: 12, color: 'var(--terminal-green)', fontFamily: "'VT323', monospace", lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {dialText}<span style={{ animation: 'blink 1s infinite' }}>_</span>
              </pre>
            </div>
          )}
          {phase === 'downloading' && (
            <div>
              <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 'bold' }}>Downloading dev credentials...</div>
              {files.map((f, i) => {
                const p = Math.max(0, Math.min(100, progress - i * 15));
                return (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                      <span>📄 {f.name}</span><span style={{ color: '#666' }}>{f.size}</span>
                    </div>
                    <div style={{ height: 12, background: '#000', border: '1px solid var(--border-dark)' }}>
                      <div style={{ width: `${p}%`, height: '100%', background: p >= 100 ? 'var(--terminal-green)' : '#000080', transition: 'width 0.1s' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>{progress}% complete</div>
            </div>
          )}
          {phase === 'complete' && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--terminal-green)' }}>MINT SUCCESSFUL</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Your new developer has been assigned.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
