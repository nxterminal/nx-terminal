export default function CodeEditor({ codeLines, answers, onAnswerChange, errors, showHints, onToggleHint, filledCount, totalBlanks }) {
  return (
    <div className="ms-editor">
      <div className="ms-editor-header">
        <span>CODE EDITOR</span>
        <span>{filledCount}/{totalBlanks} blanks filled</span>
      </div>
      <div className="ms-editor-body">
        {codeLines.map((line) => {
          const hasError = errors.includes(line.num);
          if (!line.editable) {
            return (
              <div key={line.num} className="ms-code-line">
                <span className="ms-line-num">{line.num}</span>
                <span className="ms-code-text">{line.text || '\u00A0'}</span>
              </div>
            );
          }
          const val = answers[line.num] || '';
          const inputWidth = Math.max((line.blank?.length || 8) * 8.5, 60);
          return (
            <div key={line.num}>
              <div className={`ms-code-line editable${hasError ? ' error' : ''}`}>
                <span className="ms-line-num">{line.num}</span>
                <span className="ms-code-text">
                  {line.text}
                  <input
                    className={`ms-code-input${hasError ? ' ms-code-input-error' : ''}`}
                    type="text"
                    value={val}
                    onChange={(e) => onAnswerChange(line.num, e.target.value)}
                    placeholder={line.blank}
                    style={{ width: `${inputWidth}px` }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {line.suffix && <span>{line.suffix}</span>}
                </span>
                <button
                  className="ms-hint-btn"
                  onClick={() => onToggleHint(line.num)}
                  title="Show hint"
                >?</button>
              </div>
              {showHints[line.num] && line.hint && (
                <div className="ms-hint">
                  <span className="ms-hint-label">HINT: </span>
                  <span className="ms-hint-text">{line.hint}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
