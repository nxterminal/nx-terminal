import { useState } from 'react';
import { CORPS } from '../data/corps';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';

export default function CodeLesson({ lesson, corp, onComplete }) {
  const [code, setCode] = useState(lesson.starter || "");
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [aiHelp, setAiHelp] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const c = CORPS[corp];

  const checkCode = () => {
    const clean = s => s.replace(/\s+/g, " ").replace(/['"]/g, '"').trim();
    const userClean = clean(code);
    const keywords = lesson.solution.match(/\b\w+\b/g) || [];
    const matched = keywords.filter(k => userClean.includes(k));
    const ratio = matched.length / keywords.length;
    if (ratio > 0.8) setFeedback({ success: true, msg: `Correct! +${lesson.xp} XP earned.` });
    else if (ratio > 0.5) setFeedback({ success: false, msg: "Almost there! Check the syntax and try again." });
    else setFeedback({ success: false, msg: "Not quite. Review the hint and try a different approach." });
  };

  const getAiHelp = async () => {
    setLoadingAi(true); setAiHelp("");
    try {
      const resp = await fetch(`${API_BASE}/api/academy/ai-mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: lesson.prompt, expected: lesson.solution, studentCode: code }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setAiHelp(data.hint || "No hint available.");
      } else {
        const err = await resp.json().catch(() => ({}));
        setAiHelp(err.detail || "AI Mentor temporarily unavailable.");
      }
    } catch { setAiHelp("AI Mentor offline. Try the hint button."); }
    setLoadingAi(false);
  };

  const btnBase = { border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "system-ui, sans-serif" };

  return (
    <div style={{ padding: "24px 24px 80px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, color: "#475569", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
          <span style={{ color: c?.color }}>{c?.name}</span>
          <span style={{ color: "#334155" }}>/</span>
          <span>{lesson.title}</span>
          <span style={{ marginLeft: "auto", background: "#eab30812", color: "#eab308", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>+{lesson.xp} XP</span>
        </div>

        <div style={{ background: "#10b98108", border: "1px solid #10b98118", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>{lesson.prompt}</p>
        </div>

        <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ background: "#0f172a", padding: "7px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#f43f5e" }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#eab308" }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#10b981" }} />
            <span style={{ color: "#475569", fontSize: 11, fontFamily: "system-ui, sans-serif", marginLeft: 8 }}>editor.js</span>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
            style={{
              width: "100%", minHeight: 130, background: "#020617", color: "#e2e8f0",
              fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, padding: 14,
              border: "none", outline: "none", resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={checkCode} style={{ ...btnBase, background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff" }}>Run Code</button>
          <button onClick={() => setShowHint(!showHint)} style={{ ...btnBase, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" }}>
            {showHint ? "Hide Hint" : "Hint"}
          </button>
          <button onClick={getAiHelp} disabled={loadingAi} style={{ ...btnBase, background: "#1e293b", color: "#c4b5fd", border: "1px solid #334155", cursor: loadingAi ? "wait" : "pointer" }}>
            {loadingAi ? "Thinking..." : "AI Mentor"}
          </button>
          <button onClick={() => setCode(lesson.solution)} style={{ ...btnBase, background: "transparent", color: "#475569", border: "1px solid #1e293b", marginLeft: "auto" }}>
            Show Solution
          </button>
        </div>

        {showHint && (
          <div style={{ background: "#eab30808", border: "1px solid #eab30818", borderRadius: 10, padding: 13, marginBottom: 14, color: "#eab308", fontSize: 13, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
            {lesson.hint}
          </div>
        )}

        {aiHelp && (
          <div style={{ background: "#8b5cf608", border: "1px solid #8b5cf618", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 600, marginBottom: 5, fontFamily: "system-ui, sans-serif" }}>AI Mentor</div>
            <pre style={{ color: "#c4b5fd", fontSize: 13, fontFamily: "system-ui, sans-serif", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{aiHelp}</pre>
          </div>
        )}

        {feedback && (
          <div style={{
            background: feedback.success ? "#10b9810c" : "#f43f5e0c",
            border: `1px solid ${feedback.success ? "#10b98125" : "#f43f5e25"}`,
            borderRadius: 10, padding: 14, marginBottom: 14,
            color: feedback.success ? "#10b981" : "#f43f5e",
            fontSize: 13, fontFamily: "system-ui, sans-serif",
          }}>{feedback.msg}</div>
        )}

        {feedback?.success && (
          <button onClick={() => onComplete(true)} style={{
            background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
          }}>Next Lesson</button>
        )}
      </div>
    </div>
  );
}
