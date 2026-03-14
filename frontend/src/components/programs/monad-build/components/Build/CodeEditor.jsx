import { useRef } from 'react';

function getLineCount(text) {
  return (text || '').split('\n').length;
}

export default function CodeEditor({ value, onChange, readOnly = false, height = 400 }) {
  const textareaRef = useRef(null);
  const lineCount = getLineCount(value);

  return (
    <div className="mb-editor-wrap" style={{ height }}>
      <div className="mb-editor-lines" style={{ height }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="mb-editor-textarea"
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        style={{ height: '100%' }}
      />
    </div>
  );
}
