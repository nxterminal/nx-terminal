import { useState, useEffect } from 'react';

const DEFAULT_CONTENT = `=== NX TERMINAL \u2014 PERSONAL NOTES ===

TODO:
  1. Win the Protocol Wars
  2. Don't get fired
  3. Collect salary before tax
  4. ???
  5. Mass-produce protocols

NOTES:
  * The coffee at HQ tastes like TCP packets
  * DO NOT open the file called 'totally_not_a_virus.exe'
  * HR said my mass-produced resignation letter was 'cute'
  * The AI in Lab 3 has become self-aware again

PASSWORD REMINDER:
  * NX Terminal login: ********
  * Salary portal: ********
  * Everything is ********`;

const STORAGE_KEY = 'nx-notepad';

export default function Notepad() {
  const [text, setText] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setText(saved !== null ? saved : DEFAULT_CONTENT);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, text);
    setSavedMsg(true);
    setFileMenuOpen(false);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleNew = () => {
    setFileMenuOpen(false);
    if (window.confirm('Start a new document? Any unsaved changes will be lost.')) {
      setText('');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--win-bg)' }}>
      {/* Menu bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '1px 4px',
        borderBottom: '1px solid var(--border-dark)',
        position: 'relative',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative' }}>
          <button
            style={{
              background: fileMenuOpen ? 'var(--selection)' : 'transparent',
              color: fileMenuOpen ? 'var(--selection-text)' : '#000',
              border: 'none',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
            }}
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            onBlur={() => setTimeout(() => setFileMenuOpen(false), 150)}
          >
            File
          </button>
          {fileMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'var(--win-bg)',
              border: '1px solid #000',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
              zIndex: 100,
              minWidth: '120px',
            }}>
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '4px 24px 4px 12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
                }}
                onMouseOver={(e) => { e.target.style.background = 'var(--selection)'; e.target.style.color = '#fff'; }}
                onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = '#000'; }}
                onMouseDown={handleNew}
              >
                New
              </button>
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '4px 24px 4px 12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
                }}
                onMouseOver={(e) => { e.target.style.background = 'var(--selection)'; e.target.style.color = '#fff'; }}
                onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = '#000'; }}
                onMouseDown={handleSave}
              >
                Save
              </button>
            </div>
          )}
        </div>
        {savedMsg && (
          <span style={{
            marginLeft: '12px',
            fontSize: '11px',
            color: 'var(--terminal-green)',
            fontWeight: 'bold',
          }}>
            Saved!
          </span>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '8px',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '13px',
          lineHeight: '1.5',
          background: '#fff',
          color: '#000',
          boxShadow: 'inset -1px -1px 0 var(--border-light), inset 1px 1px 0 var(--border-dark)',
        }}
      />

      {/* Status bar */}
      <div style={{
        flexShrink: 0,
        padding: '2px 8px',
        fontSize: '11px',
        color: '#444',
        borderTop: '1px solid var(--border-dark)',
        boxShadow: 'inset -1px -1px 0 var(--border-light), inset 1px 1px 0 var(--border-dark)',
      }}>
        {text.length} characters | NX Notepad v1.0
      </div>
    </div>
  );
}
