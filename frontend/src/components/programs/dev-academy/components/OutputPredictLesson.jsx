import { useState } from 'react';
import { CORPS } from '../data/corps';

export default function OutputPredictLesson({ lesson, corp, onComplete }) {
  const c = CORPS[corp];
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selected === lesson.correct;
  const locked = submitted || revealed;

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
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
          What will this code output? Read carefully and predict the result.
        </p>

        {/* Code display */}
        <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: '#0f172a', padding: '7px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#f43f5e' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#eab308' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981' }} />
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginLeft: 8 }}>predict.js</span>
          </div>
          <div style={{ padding: 14 }}>
            {lesson.code.split('\n').map((line, i) => (
              <div key={i} style={{ display: 'flex', minHeight: 24 }}>
                <span style={{ color: '#475569', width: 28, textAlign: 'right', marginRight: 12, fontSize: 11, userSelect: 'none', fontFamily: 'monospace' }}>{i + 1}</span>
                <code style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre' }}>{line}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Simulated console output prompt */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 }}>{'>'} Console output:</div>
          <div style={{ color: '#94a3b8', fontSize: 13, fontFamily: 'monospace' }}>???</div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {lesson.options.map((opt, i) => {
            let bg = '#0f172a', border = '#1e293b', color = '#cbd5e1';
            if (submitted && isCorrect) {
              if (i === lesson.correct) { bg = '#10b98112'; border = '#10b981'; color = '#10b981'; }
              else if (i === selected) { bg = '#f43f5e12'; border = '#f43f5e'; color = '#f43f5e'; }
            } else if (revealed) {
              if (i === lesson.correct) { bg = '#10b98112'; border = '#10b981'; color = '#10b981'; }
              else if (i === selected) { bg = '#f43f5e12'; border = '#f43f5e'; color = '#f43f5e'; }
            } else if (submitted && !isCorrect && i === selected) {
              bg = '#f43f5e12'; border = '#f43f5e'; color = '#f43f5e';
            } else if (i === selected) { bg = '#1e293b'; border = '#3b82f6'; color = '#f1f5f9'; }
            return (
              <button key={i} onClick={() => !locked && setSelected(i)} style={{
                background: bg, border: `1px solid ${border}`, borderRadius: 10,
                padding: '10px 16px', textAlign: 'left', cursor: locked ? 'default' : 'pointer',
                color, fontSize: 13, fontFamily: 'monospace', transition: 'all 0.15s',
              }}>
                <code>{opt}</code>
              </button>
            );
          })}
        </div>

        {!submitted && !revealed && selected !== null && (
          <button onClick={() => setSubmitted(true)} style={{
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>Submit Prediction</button>
        )}

        {submitted && isCorrect && (
          <>
            <div style={{
              background: '#10b9810c', border: '1px solid #10b98125',
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif',
            }}>
              <span style={{ color: '#10b981' }}>Correct prediction! +{lesson.xp} XP earned.</span>
            </div>

            {lesson.trace && (
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ color: '#06b6d4', fontSize: 12, fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Step-by-step execution:</div>
                {lesson.trace.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, fontFamily: 'monospace' }}>
                    <span style={{ color: '#475569', minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ color: '#cbd5e1' }}>{step}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => onComplete(true)} style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Next Lesson</button>
          </>
        )}

        {submitted && !isCorrect && !revealed && (
          <>
            <div style={{
              background: '#f43f5e0c', border: '1px solid #f43f5e25',
              borderRadius: 10, padding: 14, marginBottom: 14,
              fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#f43f5e',
            }}>
              Not quite — try again, or reveal the answer to move on without XP.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSelected(null); setSubmitted(false); }} style={{
                background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Try Again</button>
              <button onClick={() => setRevealed(true)} style={{
                background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Show correct answer</button>
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
              <div style={{ color: '#eab308', marginBottom: 6 }}>
                Answer revealed — no XP awarded. The output is: <code style={{ color: '#10b981' }}>{lesson.options[lesson.correct]}</code>
              </div>
              {lesson.explanation && <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>{lesson.explanation}</div>}
            </div>

            {lesson.trace && (
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ color: '#06b6d4', fontSize: 12, fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Step-by-step execution:</div>
                {lesson.trace.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, fontFamily: 'monospace' }}>
                    <span style={{ color: '#475569', minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ color: '#cbd5e1' }}>{step}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => onComplete(false)} style={{
              background: 'linear-gradient(135deg, #64748b, #475569)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            }}>Next Lesson</button>
          </>
        )}
      </div>
    </div>
  );
}
