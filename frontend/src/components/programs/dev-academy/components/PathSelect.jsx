import { GENERAL_PATH } from '../data/generalPath';
import { PHAROS_PATH } from '../data/monadPath';
import ProgressBar from './ProgressBar';

export default function PathSelect({ dev, onSelect, progress }) {
  const paths = [
    { data: GENERAL_PATH, accent: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)", tag: "BEGINNER" },
    { data: PHAROS_PATH, accent: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)", tag: "BLOCKCHAIN" },
  ];

  return (
    <div style={{ padding: "32px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#1e293b", borderRadius: 20, padding: "4px 12px", marginBottom: 10,
          }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
              {dev.demo ? "Demo Mode" : `Dev #${dev.devId} / ${dev.species}`}
            </span>
          </div>
          <h2 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 700, margin: "0 0 4px", fontFamily: "system-ui, sans-serif", letterSpacing: "-0.02em" }}>
            Choose your path
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0, fontFamily: "system-ui, sans-serif" }}>
            Pick a track to start learning. Switch anytime.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {paths.map(({ data, accent, gradient, tag }) => {
            const total = data.modules.reduce((a, m) => a + m.lessons.length, 0);
            const done = data.modules.reduce((a, m) => a + m.lessons.filter(l => progress[l.id]).length, 0);
            return (
              <div key={data.id} onClick={() => onSelect(data.id)} style={{
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14,
                padding: 22, cursor: "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden",
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = accent + "50"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ position: "absolute", top: -50, right: -50, width: 130, height: 130, background: `radial-gradient(circle, ${accent}08, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "monospace",
                    flexShrink: 0, boxShadow: `0 4px 14px ${accent}25`,
                  }}>{data.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <h3 style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 600, margin: 0, fontFamily: "system-ui, sans-serif" }}>{data.name}</h3>
                      <span style={{ background: accent + "18", color: accent, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, fontFamily: "system-ui, sans-serif", letterSpacing: "0.04em" }}>{tag}</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{data.description}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}><ProgressBar value={done} max={total} color={accent} /></div>
                      <span style={{ color: "#64748b", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{done}/{total}</span>
                    </div>
                  </div>
                  <div style={{ color: "#334155", fontSize: 18, marginTop: 12, fontFamily: "system-ui, sans-serif" }}>&rarr;</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
