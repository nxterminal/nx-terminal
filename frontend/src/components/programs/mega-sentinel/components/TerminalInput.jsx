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
      fontSize: '13px', padding: '10px 14px',
      background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
      borderRadius: '4px',
    }}>
      <span style={{ color: COLORS.muted, whiteSpace: 'nowrap', fontSize: '12px' }}>
        {label || 'Contract address:'}
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
          color: COLORS.text, fontFamily: 'monospace',
          fontSize: '13px', caretColor: COLORS.green,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!isValid || disabled}
        style={{
          background: isValid && !disabled ? COLORS.green : COLORS.border,
          border: 'none', borderRadius: '3px',
          color: isValid && !disabled ? '#fff' : COLORS.muted,
          fontSize: '11px', fontWeight: '600',
          padding: '4px 14px', cursor: isValid && !disabled ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
      >
        SCAN
      </button>
    </div>
  );
}
