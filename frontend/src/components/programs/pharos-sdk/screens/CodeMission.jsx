import { useState, useCallback } from 'react';
import MissionHeader from '../components/MissionHeader';
import CodeEditor from '../components/CodeEditor';

export default function CodeMission({ mission, onCompile, onBack }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [showHints, setShowHints] = useState({});

  const editableLines = mission.codeLines.filter(l => l.editable);
  const allFilled = editableLines.every(l => (answers[l.num] || '').trim().length > 0);

  const handleAnswerChange = useCallback((lineNum, value) => {
    setAnswers(prev => ({ ...prev, [lineNum]: value }));
    setErrors(prev => prev.filter(n => n !== lineNum));
  }, []);

  const handleToggleHint = useCallback((lineNum) => {
    setShowHints(prev => ({ ...prev, [lineNum]: !prev[lineNum] }));
  }, []);

  const handleCompile = useCallback(() => {
    if (!allFilled) return;
    // Validate answers
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

  return (
    <div className="ps-code-mission">
      <MissionHeader mission={mission} onBack={onBack} />
      <div className="ps-briefing">{mission.briefing}</div>
      <div className="ps-code-mission-body">
        <CodeEditor
          codeLines={mission.codeLines}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          errors={errors}
          showHints={showHints}
          onToggleHint={handleToggleHint}
        />
        <div className="ps-compiler-output-bar">
          {errors.length > 0 ? (
            <span style={{ color: '#ff3333' }}>
              {'\u25B6'} Errors on line{errors.length > 1 ? 's' : ''}: {errors.join(', ')}. Fix and recompile.
            </span>
          ) : (
            <span style={{ color: '#888' }}>
              {'\u25B6'} {allFilled ? 'Ready to compile. Press [COMPILE].' : 'Fill all blanks and press [COMPILE]'}
            </span>
          )}
        </div>
        <div className="ps-compile-btn-row">
          <button
            className={`ps-compile-btn${allFilled ? ' active' : ''}`}
            onClick={handleCompile}
            disabled={!allFilled}
          >
            {'\u25B6'} COMPILE
          </button>
        </div>
      </div>
    </div>
  );
}
