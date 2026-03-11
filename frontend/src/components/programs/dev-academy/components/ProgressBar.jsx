export default function ProgressBar({ value, max, color = "#10b981" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: "100%", height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color,
        borderRadius: 3, transition: "width 0.5s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}
