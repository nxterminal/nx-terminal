import { useState } from 'react';
import { CORPS } from '../data/corps';

export default function ConceptLesson({ lesson, corp, onComplete }) {
  const [phase, setPhase] = useState("learn");
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const c = CORPS[corp];

  return (
    <div style={{ padding: "24px 24px 80px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, color: "#475569", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
          <span style={{ color: c?.color }}>{c?.name}</span>
          <span style={{ color: "#334155" }}>/</span>
          <span>{lesson.title}</span>
          <span style={{ marginLeft: "auto", background: "#eab30812", color: "#eab308", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>+{lesson.xp} XP</span>
        </div>

        {phase === "learn" && (
          <>
            <h3 style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, margin: "0 0 16px", fontFamily: "system-ui, sans-serif" }}>{lesson.title}</h3>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 22, marginBottom: 20 }}>
              <pre style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>{lesson.content}</pre>
            </div>
            <button onClick={() => setPhase("quiz")} style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", border: "none",
              borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
            }}>Continue to Quiz</button>
          </>
        )}

        {phase === "quiz" && (
          <>
            <div style={{ background: "#10b9810c", border: "1px solid #10b98120", borderRadius: 12, padding: 18, marginBottom: 18 }}>
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 500, margin: 0, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>{lesson.question}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {lesson.options.map((opt, i) => {
                let bg = "#0f172a", border = "#1e293b", color = "#cbd5e1";
                if (answered) {
                  if (i === lesson.correct) { bg = "#10b98112"; border = "#10b981"; color = "#10b981"; }
                  else if (i === selected) { bg = "#f43f5e12"; border = "#f43f5e"; color = "#f43f5e"; }
                } else if (i === selected) { bg = "#1e293b"; border = "#3b82f6"; color = "#f1f5f9"; }
                return (
                  <button key={i} onClick={() => !answered && setSelected(i)} style={{
                    background: bg, border: `1px solid ${border}`, borderRadius: 10,
                    padding: "12px 16px", textAlign: "left", cursor: answered ? "default" : "pointer",
                    color, fontSize: 14, fontFamily: "system-ui, sans-serif", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: i === selected ? (answered ? (i === lesson.correct ? "#10b981" : "#f43f5e") : "#3b82f6") : "#1e293b",
                      color: i === selected ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!answered && selected !== null && (
              <button onClick={() => setAnswered(true)} style={{
                background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", border: "none",
                borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
              }}>Submit Answer</button>
            )}
            {answered && (
              <>
                <div style={{
                  background: selected === lesson.correct ? "#10b9810c" : "#f43f5e0c",
                  border: `1px solid ${selected === lesson.correct ? "#10b98125" : "#f43f5e25"}`,
                  borderRadius: 10, padding: 14, marginBottom: 14,
                  color: selected === lesson.correct ? "#10b981" : "#f43f5e",
                  fontSize: 13, fontFamily: "system-ui, sans-serif",
                }}>
                  {selected === lesson.correct ? `Correct! +${lesson.xp} XP earned.` : `Not quite. The answer was: ${lesson.options[lesson.correct]}`}
                </div>
                <button onClick={() => onComplete(selected === lesson.correct)} style={{
                  background: selected === lesson.correct ? "linear-gradient(135deg, #10b981, #06b6d4)" : "linear-gradient(135deg, #f43f5e, #e11d48)",
                  color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
                }}>{selected === lesson.correct ? "Next Lesson" : "Try Again"}</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
