import { useState } from 'react';
import { CORPS } from '../data/corps';

export default function FixBugLesson({ lesson, corp, onComplete }) {
  const c = CORPS[corp];
  const [code, setCode] = useState(lesson.buggyCode || "");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);

  const hints = lesson.hints || [lesson.hint || "Look carefully at each line."];

  const checkFix = () => {
    const clean = s => s.replace(/\s+/g, ' ').replace(/['"]/g, '"').trim();
    const userClean = clean(code);
    const solutionClean = clean(lesson.solution);

    if (userClean === solutionClean) {
      setFeedback({ success: true, msg: `Bug fixed! +${lesson.xp} XP earned.` });
      return;
    }

    const fixChecks = lesson.fixChecks || [];
    const allFixed = fixChecks.every(check => {
      if (check.mustContain) return userClean.includes(clean(check.mustContain));
      if (check.mustNotContain) return !userClean.includes(clean(check.mustNotContain));
      return true;
    });

    if (allFixed && fixChecks.length > 0) {
      setFeedback({ success: true, msg: `Bug fixed! +${lesson.xp} XP earned.` });
    } else {
      const failedCheck = fixChecks.find(check => {
        if (check.mustContain) return !userClean.includes(clean(check.mustContain));
        if (check.mustNotContain) return userClean.includes(clean(check.mustNotContain));
        return false;
      });
      setFeedback({
        success: false,
        msg: failedCheck?.errorMsg || "The bug is still there. Look at the hint for guidance.",
      });
    }
  };

  const revealNextHint = () => {
    setShowHint(true);
    if (hintLevel < hints.length - 1) setHintLevel(h => h + 1);
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

        <div style={{
          background: '#f43f5e0a', border: '1px solid #f43f5e20', borderRadius: 12, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.05em' }}>BUG REPORT</span>
          </div>
          <p style={{ color: '#e2e8f0', fontSize: 14, margin: 0, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>{lesson.prompt}</p>
          {lesson.errorOutput && (
            <div style={{ marginTop: 10, background: '#0f172a', borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: '#f43f5e' }}>
              Output: {lesson.errorOutput}
            </div>
          )}
        </div>

        <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: '#0f172a', padding: '7px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#f43f5e' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#eab308' }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981' }} />
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginLeft: 8 }}>buggy.js</span>
            <span style={{ color: '#f43f5e', fontSize: 10, fontFamily: 'system-ui, sans-serif', marginLeft: 'auto' }}>Find and fix the bug</span>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
            style={{
              width: '100%', minHeight: 150, background: '#020617', color: '#e2e8f0',
              fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, padding: 14,
              border: 'none', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={checkFix} style={{
            background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>Test Fix</button>
          <button onClick={revealNextHint} style={{
            background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>Hint {hintLevel > 0 ? `(${hintLevel}/${hints.length})` : ''}</button>
          <button onClick={() => setCode(lesson.solution)} style={{
            background: 'transparent', color: '#475569', border: '1px solid #1e293b',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', marginLeft: 'auto',
          }}>Show Fix</button>
        </div>

        {showHint && (
          <div style={{ background: '#eab30808', border: '1px solid #eab30818', borderRadius: 10, padding: 13, marginBottom: 14, color: '#eab308', fontSize: 13, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
            {hints.slice(0, hintLevel + 1).map((h, i) => (
              <div key={i} style={{ marginBottom: i < hintLevel ? 6 : 0, opacity: i < hintLevel ? 0.6 : 1 }}>
                Hint {i + 1}: {h}
              </div>
            ))}
          </div>
        )}

        {feedback && (
          <div style={{
            background: feedback.success ? '#10b9810c' : '#f43f5e0c',
            border: `1px solid ${feedback.success ? '#10b98125' : '#f43f5e25'}`,
            borderRadius: 10, padding: 14, marginBottom: 14,
            color: feedback.success ? '#10b981' : '#f43f5e',
            fontSize: 13, fontFamily: 'system-ui, sans-serif',
          }}>{feedback.msg}</div>
        )}

        {feedback?.success && (
          <button onClick={() => onComplete(true)} style={{
            background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>Next Lesson</button>
        )}
      </div>
    </div>
  );
}
