import { useState } from 'react';

const DEFAULT_TEXT = `=== NX TERMINAL NOTEPAD ===

Welcome to Notepad. Use this space for your notes.

Tips:
- Track your dev strategies here
- Keep notes on protocol investments
- Write down wallet addresses
- Plan your next moves

---
Your notes are saved locally in this session.
`;

export default function Notepad() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [wordWrap, setWordWrap] = useState(true);

  const lines = text.split('\n').length;
  const chars = text.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '0', padding: '1px 4px', background: 'var(--win-bg)', borderBottom: '1px solid var(--border-dark)', fontSize: '11px' }}>
        <button className="win-btn" style={{ padding: '1px 8px', fontSize: '11px', border: 'none', boxShadow: 'none', background: 'transparent' }}>File</button>
        <button className="win-btn" style={{ padding: '1px 8px', fontSize: '11px', border: 'none', boxShadow: 'none', background: 'transparent' }}>Edit</button>
        <button className="win-btn" onClick={() => setWordWrap(w => !w)} style={{ padding: '1px 8px', fontSize: '11px', border: 'none', boxShadow: 'none', background: 'transparent' }}>
          {wordWrap ? '✓ ' : ''}Word Wrap
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          padding: '4px 8px',
          fontFamily: "'Courier New', monospace",
          fontSize: '12px',
          lineHeight: '1.4',
          background: '#fff',
          color: '#000',
          whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          overflowWrap: wordWrap ? 'break-word' : 'normal',
          overflow: 'auto',
        }}
        spellCheck={false}
      />
      <div className="win98-statusbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Ln {lines}, Col 1</span>
        <span>{chars} characters</span>
      </div>
    </div>
  );
}
