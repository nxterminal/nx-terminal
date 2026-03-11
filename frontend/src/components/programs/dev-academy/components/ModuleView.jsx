import { CORPS } from '../data/corps';
import ProgressBar from './ProgressBar';
import CorpBadge from './CorpBadge';

export default function ModuleView({ pathData, progress, onStartLesson, onBack, xp }) {
  return (
    <div style={{ padding: "24px 24px 80px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "#64748b", cursor: "pointer",
          fontSize: 13, fontFamily: "system-ui, sans-serif", padding: 0, marginBottom: 20,
          display: "flex", alignItems: "center", gap: 6,
        }}>&larr; All Paths</button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 2px", fontFamily: "system-ui, sans-serif" }}>{pathData.name}</h2>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0, fontFamily: "system-ui, sans-serif" }}>
              {pathData.modules.length} modules
            </p>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: "#eab308", fontSize: 15, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>{xp}</span>
            <span style={{ color: "#64748b", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>XP</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pathData.modules.map((mod, mi) => {
            const corp = CORPS[mod.corp];
            const done = mod.lessons.filter(l => progress[l.id]).length;
            const total = mod.lessons.length;
            const isComplete = done === total;
            const prevComplete = mi === 0 || pathData.modules[mi - 1].lessons.every(l => progress[l.id]);

            return (
              <div key={mod.id} style={{
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14,
                padding: 18, opacity: prevComplete ? 1 : 0.35, transition: "opacity 0.3s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <CorpBadge corp={mod.corp} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
                      {mod.title} {isComplete && <span style={{ color: "#10b981", fontWeight: 400, fontSize: 12 }}> — complete</span>}
                    </div>
                    <div style={{ color: "#475569", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                      {corp?.name} / {done} of {total}
                    </div>
                  </div>
                </div>
                <ProgressBar value={done} max={total} color={corp?.color} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {mod.lessons.map((lesson, li) => {
                    const isDone = progress[lesson.id];
                    const canDo = prevComplete && (li === 0 || progress[mod.lessons[li - 1].id]);
                    return (
                      <button key={lesson.id} disabled={!canDo} onClick={() => canDo && onStartLesson(mod, lesson)}
                        style={{
                          background: isDone ? "#10b98112" : canDo ? "#1e293b" : "#0f172a",
                          border: `1px solid ${isDone ? "#10b98135" : canDo ? "#334155" : "#1e293b"}`,
                          borderRadius: 8, padding: "7px 11px", cursor: canDo ? "pointer" : "not-allowed",
                          color: isDone ? "#10b981" : canDo ? "#94a3b8" : "#334155",
                          fontSize: 12, fontFamily: "system-ui, sans-serif",
                          display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
                        }}>
                        {isDone ? "[done]" : lesson.type === "code" ? "[code]" : "[read]"} {lesson.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
