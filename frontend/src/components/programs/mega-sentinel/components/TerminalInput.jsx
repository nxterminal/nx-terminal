import { useState } from 'react';
import { COLORS } from '../constants';

export default function TerminalInput({ label, placeholder, onSubmit, disabled }) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  const isValid = /^0x[a-fA-F0-9]{40}$/.test(value.trim());

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontFamily: '"VT323", "Courier New", monospace',
      fontSize: '14px', padding: '8px 12px',
      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
    }}>
      <span style={{ color: COLORS.green, whiteSpace: 'nowrap' }}>
        {'>'} {label || 'Enter address:'}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '0x...'}
        disabled={disabled}
        spellCheck={false}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: COLORS.cyan, fontFamily: '"VT323", "Courier New", monospace',
          fontSize: '14px', caretColor: COLORS.green,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!isValid || disabled}
        style={{
          background: isValid && !disabled ? COLORS.dimGreen : '#222',
          border: `1px solid ${isValid && !disabled ? COLORS.green : '#444'}`,
          color: isValid && !disabled ? COLORS.green : '#666',
          fontFamily: '"VT323", "Courier New", monospace',
          fontSize: '12px', padding: '2px 12px', cursor: isValid && !disabled ? 'pointer' : 'default',
        }}
      >
        SCAN
      </button>
    </div>
  );
}
