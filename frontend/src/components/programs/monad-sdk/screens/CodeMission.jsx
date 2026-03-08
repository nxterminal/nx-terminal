import { useState, useCallback, useEffect, useRef } from 'react';
import MissionHeader from '../components/MissionHeader';
import CodeEditor from '../components/CodeEditor';

export default function CodeMission({ mission, onCompile, compileTrigger }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [showHints, setShowHints] = useState({});
  const [briefingCollapsed, setBriefingCollapsed] = useState(false);
  const prevTrigger = useRef(compileTrigger);

  const editableLines = mission.codeLines.filter(l => l.editable);
  const filledCount = editableLines.filter(l => (answers[l.num] || '').trim().length > 0).length;
  const allFilled = filledCount === editableLines.length;

  const handleAnswerChange = useCallback((lineNum, value) => {
    setAnswers(prev => ({ ...prev, [lineNum]: value }));
    setErrors(prev => prev.filter(n => n !== lineNum));
  }, []);

  const handleToggleHint = useCallback((lineNum) => {
    setShowHints(prev => ({ ...prev, [lineNum]: !prev[lineNum] }));
  }, []);

  const handleCompile = useCallback(() => {
    if (!allFilled) return;
    const wrongLines = [];
    editableLines.forEach(line => {
      const userAnswer = (answers[line.num] || '').trim().toLowerCase();
      const correct = line.answer.toLowerCase();
      const alts = (line.alternatives || []).map(a => a.toLowerCase());
      if (userAnswer !== correct && !alts.includes(userAnswer)) {
        wrongLines.push(line.num);
      }
    });
    const passed = wrongLines.length === 0;
    if (!passed) {
      setErrors(wrongLines);
    }
    onCompile(passed, { wrongLines, answers });
  }, [allFilled, editableLines, answers, onCompile]);

  useEffect(() => {
    if (compileTrigger !== prevTrigger.current) {
      prevTrigger.current = compileTrigger;
      handleCompile();
    }
  }, [compileTrigger, handleCompile]);

  return (
    <div>
      <MissionHeader mission={mission} />

      <div className="ms-briefing-label">
        BRIEFING
        <span
          className="ms-briefing-toggle"
          onClick={() => setBriefingCollapsed(!briefingCollapsed)}
          style={{ marginLeft: '8px' }}
        >
          {briefingCollapsed ? 'Show more \u25BE' : 'Show less \u25B4'}
        </span>
      </div>
      <div className={`ms-briefing-panel${briefingCollapsed ? ' collapsed' : ''}`}>
        {mission.briefing}
      </div>

      <div className="ms-code-instruction">
        Fill in the blanks and press <strong>Compile</strong>:
      </div>

      <CodeEditor
        codeLines={mission.codeLines}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        errors={errors}
        showHints={showHints}
        onToggleHint={handleToggleHint}
        filledCount={filledCount}
        totalBlanks={editableLines.length}
      />

      <div className="ms-compiler-panel">
        {errors.length > 0 ? (
          <span className="ms-compiler-error">
            {'\u25B6'} Errors on line{errors.length > 1 ? 's' : ''}: {errors.join(', ')}. Fix and recompile.
          </span>
        ) : (
          <span>
            {'\u25B6'} {allFilled ? 'Ready to compile.' : `Fill all blanks (${filledCount}/${editableLines.length}) and press Compile.`}
          </span>
        )}
      </div>
    </div>
  );
}
