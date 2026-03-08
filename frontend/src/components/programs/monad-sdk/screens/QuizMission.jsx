import { useState, useCallback } from 'react';
import MissionHeader from '../components/MissionHeader';

export default function QuizMission({ mission, onComplete }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [correctCount, setCorrectCount] = useState(0);
  const questions = mission.questions;
  const q = questions[currentQ];

  const selected = answers[currentQ] ?? null;
  const showExplanation = selected !== null;

  const handleSelect = useCallback((idx) => {
    if (answers[currentQ] !== undefined) return;
    setAnswers(prev => ({ ...prev, [currentQ]: idx }));
    if (idx === q.correct) setCorrectCount(prev => prev + 1);
  }, [answers, currentQ, q]);

  const handleNext = useCallback(() => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const finalCorrect = correctCount;
      const passed = finalCorrect / questions.length >= 0.66;
      onComplete(passed, {
        correctCount: finalCorrect,
        totalQuestions: questions.length,
      });
    }
  }, [currentQ, questions, correctCount, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  }, [currentQ]);

  const isCorrectAnswer = selected !== null && selected === q.correct;

  return (
    <div>
      <MissionHeader mission={mission} />

      <div className="ms-briefing-label">BRIEFING</div>
      <div className="ms-briefing-panel">{mission.briefing}</div>

      <div className="ms-quiz-qnum">Question {currentQ + 1} of {questions.length}</div>
      <div className="ms-quiz-question">{q.question}</div>

      <div className="ms-quiz-options-panel">
        {q.options.map((opt, i) => {
          let cls = 'ms-quiz-option';
          if (selected !== null) {
            if (i === q.correct) cls += ' correct';
            if (i === selected && i !== q.correct) cls += ' wrong';
            if (i === q.correct && selected !== q.correct) cls += ' reveal-correct';
          }
          return (
            <div key={i} className={cls} onClick={() => handleSelect(i)}>
              <span className="ms-quiz-radio">
                {selected === null ? '\u25CB' : i === selected ? '\u25CF' : '\u25CB'}
              </span>
              <span className="ms-quiz-option-text">{opt}</span>
              {selected !== null && i === q.correct && (
                <span className="ms-quiz-result-icon" style={{ color: '#008800' }}>{'\u2713'}</span>
              )}
              {selected !== null && i === selected && i !== q.correct && (
                <span className="ms-quiz-result-icon" style={{ color: '#cc0000' }}>{'\u2717'}</span>
              )}
            </div>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`ms-quiz-explanation ${isCorrectAnswer ? 'correct' : 'wrong'}`}>
          <strong>{isCorrectAnswer ? '\u2713 Correct!' : '\u2717 Incorrect.'}</strong>{' '}
          {q.explanation}
        </div>
      )}

      <div className="ms-quiz-nav">
        <button className="ms-wiz-btn" onClick={handlePrev} disabled={currentQ === 0}>
          {'\u25C0'} Previous
        </button>
        <button className="ms-wiz-btn" onClick={handleNext} disabled={selected === null}>
          {currentQ < questions.length - 1 ? 'Next \u25B6' : 'Finish \u25B6'}
        </button>
      </div>

      <div className="ms-quiz-dots">
        {questions.map((_, i) => (
          <span key={i} style={{ color: answers[i] !== undefined ? '#008800' : i === currentQ ? '#000' : '#aaa' }}>
            {answers[i] !== undefined ? '\u25CF' : i === currentQ ? '\u25C9' : '\u25CB'}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
