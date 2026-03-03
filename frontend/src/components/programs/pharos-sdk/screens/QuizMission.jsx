import { useState, useCallback, useRef } from 'react';
import MissionHeader from '../components/MissionHeader';

export default function QuizMission({ mission, onComplete }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const advanceTimerRef = useRef(null);
  const questions = mission.questions;
  const q = questions[currentQ];

  const handleSelect = useCallback((idx) => {
    if (selected !== null) return;
    setSelected(idx);
    setShowExplanation(true);
    const isCorrect = idx === q.correct;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    if (isCorrect) setCorrectCount(newCorrectCount);

    advanceTimerRef.current = setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setShowExplanation(false);
      } else {
        const passed = newCorrectCount / questions.length >= 0.66;
        onComplete(passed, {
          correctCount: newCorrectCount,
          totalQuestions: questions.length,
        });
      }
    }, 2000);
  }, [selected, q, correctCount, currentQ, questions, onComplete]);

  const isCorrectAnswer = selected !== null && selected === q.correct;

  return (
    <div>
      <MissionHeader mission={mission} />

      {/* Briefing */}
      <div className="ps-briefing-label">BRIEFING</div>
      <div className="ps-briefing-panel">{mission.briefing}</div>

      {/* Question */}
      <div className="ps-quiz-qnum">Question {currentQ + 1} of {questions.length}</div>
      <div className="ps-quiz-question">{q.question}</div>

      {/* Options */}
      <div className="ps-quiz-options-panel">
        {q.options.map((opt, i) => {
          let cls = 'ps-quiz-option';
          if (selected !== null) {
            if (i === q.correct) cls += ' correct';
            if (i === selected && i !== q.correct) cls += ' wrong';
            if (i === q.correct && selected !== q.correct) cls += ' reveal-correct';
          }
          return (
            <div key={i} className={cls} onClick={() => handleSelect(i)}>
              <span className="ps-quiz-radio">
                {selected === null ? '\u25CB' : i === selected ? '\u25CF' : '\u25CB'}
              </span>
              <span className="ps-quiz-option-text">{opt}</span>
              {selected !== null && i === q.correct && (
                <span className="ps-quiz-result-icon" style={{ color: '#008800' }}>{'\u2713'}</span>
              )}
              {selected !== null && i === selected && i !== q.correct && (
                <span className="ps-quiz-result-icon" style={{ color: '#cc0000' }}>{'\u2717'}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className={`ps-quiz-explanation ${isCorrectAnswer ? 'correct' : 'wrong'}`}>
          <strong>{isCorrectAnswer ? '\u2713 Correct!' : '\u2717 Incorrect.'}</strong>{' '}
          {q.explanation}
        </div>
      )}

      {/* Progress dots */}
      <div className="ps-quiz-dots">
        {questions.map((_, i) => (
          <span key={i} style={{ color: i < currentQ ? '#008800' : i === currentQ ? '#000' : '#aaa' }}>
            {i < currentQ ? '\u25CF' : i === currentQ ? '\u25C9' : '\u25CB'}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
