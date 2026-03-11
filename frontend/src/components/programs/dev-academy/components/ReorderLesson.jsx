import { useState } from 'react';
import { CORPS } from '../data/corps';

export default function ReorderLesson({ lesson, corp, onComplete }) {
  const c = CORPS[corp];
  const [lines, setLines] = useState(() => {
    const shuffled = [...lesson.lines];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSelect = (idx) => {
    if (submitted) return;
    if (selected === null) {
      setSelected(idx);
    } else {
      const next = [...lines];
      [next[selected], next[idx]] = [next[idx], next[selected]];
      setLines(next);
      setSelected(null);
    }
  };

  const moveUp = (idx) => {
    if (idx === 0 || submitted) return;
    const next = [...lines];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLines(next);
  };

  const moveDown = (idx) => {
    if (idx === lines.length - 1 || submitted) return;
    const next = [...lines];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setLines(next);
  };

  const handleSubmit = () => {
    const correct = lines.every((line, i) => line === lesson.correctOrder[i]);
    setIsCorrect(correct);
    setSubmitted(true);
  };

  const handleReset = () => {
    const shuffled = [...lesson.lines];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setLines(shuffled);
    setSelected(null);
    setSubmitted(false);
    setIsCorrect(false);
  };

  return (
    <div style={{ padding: '24px 24px 80px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#475569', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ color: c?.color }}>{c?.name}</span>
          <span style={{ color: '#334155' }}>/</span>
          <span>{lesson.title}</span>
          <span style={{ marginLeft: 'auto', background: '#eab30812', color: '#eab308', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>+{lesson.xp} XP</span>
        </div>

        <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: '0 0 8px', fontFamily: 'system-ui, sans-serif' }}>{lesson.title}</h3>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>{lesson.prompt}</p>

        <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ background: '#0f172a', padding: '7px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#f43f5e' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#eab308' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981' }} />
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginLeft: 8 }}>reorder.js</span>
            <span style={{ color: '#06b6d4', fontSize: 10, fontFamily: 'system-ui, sans-serif', marginLeft: 'auto' }}>Click two lines to swap, or use arrows</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {lines.map((line, i) => {
              const isSelected = selected === i;
              let bg = 'transparent';
              let borderColor = 'transparent';
              if (submitted) {
                bg = line === lesson.correctOrder[i] ? '#10b98108' : '#f43f5e08';
                borderColor = line === lesson.correctOrder[i] ? '#10b98130' : '#f43f5e30';
              } else if (isSelected) {
                bg = '#3b82f610';
                borderColor = '#3b82f650';
              }
              return (
                <div key={i} onClick={() => handleSelect(i)} style={{
                  display: 'flex', alignItems: 'center', padding: '6px 14px',
                  cursor: submitted ? 'default' : 'pointer',
                  background: bg, borderLeft: `2px solid ${borderColor}`,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ color: '#475569', width: 24, textAlign: 'right', marginRight: 12, fontSize: 11, userSelect: 'none', fontFamily: 'monospace' }}>{i + 1}</span>
                  <code style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13, flex: 1 }}>{line}</code>
                  {!submitted && (
                    <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
                      <button onClick={e => { e.stopPropagation(); moveUp(i); }} disabled={i === 0}
                        style={{ background: 'none', border: '1px solid #334155', borderRadius: 4, color: i === 0 ? '#1e293b' : '#64748b', cursor: i === 0 ? 'default' : 'pointer', padding: '1px 5px', fontSize: 10 }}>
                        &#9650;
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveDown(i); }} disabled={i === lines.length - 1}
                        style={{ background: 'none', border: '1px solid #334155', borderRadius: 4, color: i === lines.length - 1 ? '#1e293b' : '#64748b', cursor: i === lines.length - 1 ? 'default' : 'pointer', padding: '1px 5px', fontSize: 10 }}>
                        &#9660;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {!submitted && (
            <button onClick={handleSubmit} style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Check Order</button>
          )}
          {!submitted && (
            <button onClick={handleReset} style={{
              background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
              borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Shuffle</button>
          )}
        </div>

        {submitted && (
          <>
            <div style={{
              background: isCorrect ? '#10b9810c' : '#f43f5e0c',
              border: `1px solid ${isCorrect ? '#10b98125' : '#f43f5e25'}`,
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif',
            }}>
              {isCorrect ? (
                <span style={{ color: '#10b981' }}>Perfect order! +{lesson.xp} XP earned.</span>
              ) : (
                <div>
                  <span style={{ color: '#f43f5e' }}>Not quite right. </span>
                  {lesson.explanation && <span style={{ color: '#94a3b8' }}>{lesson.explanation}</span>}
                </div>
              )}
            </div>
            {isCorrect ? (
              <button onClick={() => onComplete(true)} style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Next Lesson</button>
            ) : (
              <button onClick={handleReset} style={{
                background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Try Again</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
