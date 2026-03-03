import { useState, useCallback, useRef } from 'react';
import MissionHeader from '../components/MissionHeader';

export default function QuizMission({ mission, onComplete, onBack }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const advanceTimerRef = useRef(null);
  const questions = mission.questions;
  const q = questions[currentQ];
  const letters = ['A', 'B', 'C', 'D'];

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
        // Quiz done — pass if >= 66%
        const passed = newCorrectCount / questions.length >= 0.66;
        onComplete(passed, {
          correctCount: newCorrectCount,
          totalQuestions: questions.length,
        });
      }
    }, 2000);
  }, [selected, q, correctCount, currentQ, questions, onComplete]);

  return (
    <div className="ps-quiz-mission">
      <MissionHeader mission={mission} onBack={() => {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        onBack();
      }} />
      <div className="ps-briefing">{mission.briefing}</div>
      <div className="ps-quiz-content">
        <div className="ps-quiz-question">{q.question}</div>
        <div className="ps-quiz-options">
          {q.options.map((opt, i) => {
            let cls = 'ps-quiz-option';
            if (selected !== null) {
              if (i === q.correct) cls += ' correct';
              else if (i === selected) cls += ' wrong';
            }
            return (
              <div
                key={i}
                className={cls}
                onClick={() => handleSelect(i)}
              >
                <span className="ps-quiz-letter">{letters[i]}.</span> {opt}
              </div>
            );
          })}
        </div>
        {showExplanation && (
          <div className="ps-quiz-explanation">
            <span style={{ color: '#00bfff' }}>{'\u25B6'} </span>
            {q.explanation}
          </div>
        )}
        <div className="ps-quiz-dots">
          {questions.map((_, i) => (
            <span key={i} style={{ color: i < currentQ ? '#00ff41' : i === currentQ ? '#fff' : '#444' }}>
              {i < currentQ ? '\u25CF' : i === currentQ ? '\u25C9' : '\u25CB'}{' '}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
