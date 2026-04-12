import { useState } from 'react';
import { CORPS } from '../data/corps';

export default function FillBlankLesson({ lesson, corp, onComplete }) {
  const c = CORPS[corp];
  const blanks = lesson.blanks || [];
  const [answers, setAnswers] = useState(blanks.map(() => ""));
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleChange = (idx, val) => {
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);
  };

  const handleSubmit = () => {
    const res = blanks.map((b, i) => {
      const userAns = answers[i].trim().toLowerCase().replace(/[;'"]/g, '');
      const expected = b.answer.toLowerCase().replace(/[;'"]/g, '');
      return userAns === expected;
    });
    setResults(res);
    setSubmitted(true);
  };

  const allCorrect = results && results.every(Boolean);

  const renderCodeWithBlanks = () => {
    const lines = lesson.code.split('\n');
    let blankIdx = 0;
    return lines.map((line, li) => {
      const parts = line.split('___');
      if (parts.length === 1) {
        return (
          <div key={li} style={{ display: 'flex', alignItems: 'center', minHeight: 28 }}>
            <span style={{ color: '#475569', width: 28, textAlign: 'right', marginRight: 12, fontSize: 11, userSelect: 'none' }}>{li + 1}</span>
            <code style={{ color: '#e2e8f0' }}>{line}</code>
          </div>
        );
      }
      const currentBlankIdx = blankIdx;
      blankIdx++;
      const isCorrect = results ? results[currentBlankIdx] : null;
      return (
        <div key={li} style={{ display: 'flex', alignItems: 'center', minHeight: 28 }}>
          <span style={{ color: '#475569', width: 28, textAlign: 'right', marginRight: 12, fontSize: 11, userSelect: 'none' }}>{li + 1}</span>
          <code style={{ color: '#e2e8f0' }}>{parts[0]}</code>
          <input
            value={answers[currentBlankIdx]}
            onChange={e => handleChange(currentBlankIdx, e.target.value)}
            disabled={(submitted && isCorrect) || revealed}
            placeholder={blanks[currentBlankIdx]?.placeholder || '...'}
            style={{
              background: submitted
                ? (isCorrect ? '#10b98115' : '#f43f5e15')
                : '#1e293b',
              border: `1px solid ${submitted ? (isCorrect ? '#10b981' : '#f43f5e') : '#334155'}`,
              borderRadius: 4, padding: '2px 8px', margin: '0 2px',
              color: submitted ? (isCorrect ? '#10b981' : '#f43f5e') : '#f1f5f9',
              fontFamily: 'monospace', fontSize: 13, outline: 'none',
              width: Math.max(80, (blanks[currentBlankIdx]?.answer.length || 8) * 10),
            }}
          />
          <code style={{ color: '#e2e8f0' }}>{parts[1]}</code>
        </div>
      );
    });
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
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginLeft: 8 }}>fill-in.js</span>
          </div>
          <div style={{ padding: 14, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
            {renderCodeWithBlanks()}
          </div>
        </div>

        {!submitted && (
          <button onClick={handleSubmit} disabled={answers.some(a => !a.trim())} style={{
            background: answers.some(a => !a.trim()) ? '#1e293b' : 'linear-gradient(135deg, #10b981, #06b6d4)',
            color: answers.some(a => !a.trim()) ? '#475569' : '#fff', border: 'none',
            borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600,
            cursor: answers.some(a => !a.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>Check Answers</button>
        )}

        {submitted && allCorrect && (
          <>
            <div style={{
              background: '#10b9810c', border: '1px solid #10b98125',
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif',
            }}>
              <span style={{ color: '#10b981' }}>All blanks correct! +{lesson.xp} XP earned.</span>
            </div>
            <button onClick={() => onComplete(true)} style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Next Lesson</button>
          </>
        )}

        {submitted && !allCorrect && !revealed && (
          <>
            <div style={{
              background: '#f43f5e0c', border: '1px solid #f43f5e25',
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#f43f5e',
            }}>
              Some answers need fixing — try again, or reveal the answers to move on without XP.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSubmitted(false); setResults(null); }} style={{
                background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Try Again</button>
              <button onClick={() => setRevealed(true)} style={{
                background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Show answers</button>
            </div>
          </>
        )}

        {revealed && (
          <>
            <div style={{
              background: '#eab30812', border: '1px solid #eab30825',
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif',
            }}>
              <div style={{ color: '#eab308', marginBottom: 6 }}>Answers revealed — no XP awarded.</div>
              {blanks.map((b, i) => (
                <div key={i} style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>
                  Blank {i + 1}: <code style={{ color: '#10b981' }}>{b.answer}</code>
                  {b.explanation && <span style={{ color: '#64748b' }}> — {b.explanation}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => onComplete(false)} style={{
              background: 'linear-gradient(135deg, #64748b, #475569)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Next Lesson</button>
          </>
        )}
      </div>
    </div>
  );
}
