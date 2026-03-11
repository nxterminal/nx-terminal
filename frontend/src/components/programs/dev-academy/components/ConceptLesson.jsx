import { useState } from 'react';
import { CORPS } from '../data/corps';

function renderContentBlock(block, idx) {
  if (block.type === 'text') {
    return (
      <p key={idx} style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.8, margin: '0 0 12px', fontFamily: 'system-ui, sans-serif' }}>
        {block.content}
      </p>
    );
  }
  if (block.type === 'code') {
    return (
      <div key={idx} style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px', marginBottom: 12, overflow: 'auto' }}>
        {block.label && (
          <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginBottom: 6 }}>{block.label}</div>
        )}
        <pre style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{block.content}</pre>
      </div>
    );
  }
  if (block.type === 'highlight') {
    return (
      <div key={idx} style={{
        background: '#10b98108', border: '1px solid #10b98118', borderRadius: 8, padding: '10px 14px', marginBottom: 12,
      }}>
        <p style={{ color: '#10b981', fontSize: 13, margin: 0, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
          {block.content}
        </p>
      </div>
    );
  }
  if (block.type === 'warn') {
    return (
      <div key={idx} style={{
        background: '#eab30808', border: '1px solid #eab30818', borderRadius: 8, padding: '10px 14px', marginBottom: 12,
      }}>
        <p style={{ color: '#eab308', fontSize: 13, margin: 0, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
          {block.content}
        </p>
      </div>
    );
  }
  if (block.type === 'list') {
    return (
      <ul key={idx} style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, margin: '0 0 12px', paddingLeft: 20, fontFamily: 'system-ui, sans-serif' }}>
        {block.items.map((item, j) => <li key={j}>{item}</li>)}
      </ul>
    );
  }
  return null;
}

export default function ConceptLesson({ lesson, corp, onComplete }) {
  const steps = lesson.steps || [{ blocks: [{ type: 'text', content: lesson.content }] }];
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState('learn');
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const c = CORPS[corp];

  const currentStep = steps[stepIdx];
  const isLastStep = stepIdx === steps.length - 1;
  const progress = steps.length > 1 ? ((stepIdx + 1) / steps.length) * 100 : 0;

  return (
    <div style={{ padding: '24px 24px 80px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#475569', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ color: c?.color }}>{c?.name}</span>
          <span style={{ color: '#334155' }}>/</span>
          <span>{lesson.title}</span>
          <span style={{ marginLeft: 'auto', background: '#eab30812', color: '#eab308', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>+{lesson.xp} XP</span>
        </div>

        {phase === 'learn' && (
          <>
            <h3 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 6px', fontFamily: 'system-ui, sans-serif' }}>{lesson.title}</h3>

            {/* Step progress indicator */}
            {steps.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: c?.color || '#10b981', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{stepIdx + 1}/{steps.length}</span>
              </div>
            )}

            {/* Step title */}
            {currentStep.title && (
              <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 12, fontFamily: 'system-ui, sans-serif' }}>
                {currentStep.title}
              </div>
            )}

            {/* Content blocks */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 22, marginBottom: 20 }}>
              {currentStep.blocks ? (
                currentStep.blocks.map((block, i) => renderContentBlock(block, i))
              ) : (
                <pre style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{lesson.content}</pre>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 8 }}>
              {stepIdx > 0 && (
                <button onClick={() => setStepIdx(s => s - 1)} style={{
                  background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                  borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}>Back</button>
              )}
              {!isLastStep ? (
                <button onClick={() => setStepIdx(s => s + 1)} style={{
                  background: `linear-gradient(135deg, ${c?.color || '#10b981'}, #06b6d4)`, color: '#fff', border: 'none',
                  borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}>Continue</button>
              ) : (
                <button onClick={() => setPhase('quiz')} style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}>Take Quiz</button>
              )}
            </div>
          </>
        )}

        {phase === 'quiz' && (
          <>
            <div style={{ background: '#10b9810c', border: '1px solid #10b98120', borderRadius: 12, padding: 18, marginBottom: 18 }}>
              <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 500, margin: 0, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>{lesson.question}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {lesson.options.map((opt, i) => {
                let bg = '#0f172a', border = '#1e293b', color = '#cbd5e1';
                if (answered) {
                  if (i === lesson.correct) { bg = '#10b98112'; border = '#10b981'; color = '#10b981'; }
                  else if (i === selected) { bg = '#f43f5e12'; border = '#f43f5e'; color = '#f43f5e'; }
                } else if (i === selected) { bg = '#1e293b'; border = '#3b82f6'; color = '#f1f5f9'; }
                return (
                  <button key={i} onClick={() => !answered && setSelected(i)} style={{
                    background: bg, border: `1px solid ${border}`, borderRadius: 10,
                    padding: '12px 16px', textAlign: 'left', cursor: answered ? 'default' : 'pointer',
                    color, fontSize: 14, fontFamily: 'system-ui, sans-serif', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: i === selected ? (answered ? (i === lesson.correct ? '#10b981' : '#f43f5e') : '#3b82f6') : '#1e293b',
                      color: i === selected ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!answered && selected !== null && (
              <button onClick={() => setAnswered(true)} style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}>Submit Answer</button>
            )}
            {answered && (
              <>
                <div style={{
                  background: selected === lesson.correct ? '#10b9810c' : '#f43f5e0c',
                  border: `1px solid ${selected === lesson.correct ? '#10b98125' : '#f43f5e25'}`,
                  borderRadius: 10, padding: 14, marginBottom: 14,
                  fontSize: 13, fontFamily: 'system-ui, sans-serif',
                }}>
                  {selected === lesson.correct ? (
                    <span style={{ color: '#10b981' }}>Correct! +{lesson.xp} XP earned.</span>
                  ) : (
                    <div>
                      <div style={{ color: '#f43f5e', marginBottom: 4 }}>Not quite. The answer was: {lesson.options[lesson.correct]}</div>
                      {lesson.explanation && <div style={{ color: '#94a3b8', marginTop: 6, lineHeight: 1.6 }}>{lesson.explanation}</div>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected !== lesson.correct && (
                    <button onClick={() => { setPhase('learn'); setStepIdx(0); setSelected(null); setAnswered(false); }} style={{
                      background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                      borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                    }}>Review Lesson</button>
                  )}
                  <button onClick={() => onComplete(selected === lesson.correct)} style={{
                    background: selected === lesson.correct ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'linear-gradient(135deg, #f43f5e, #e11d48)',
                    color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                  }}>{selected === lesson.correct ? 'Next Lesson' : 'Try Again'}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
