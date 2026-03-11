import { CORPS } from '../data/corps';

export default function CorpBadge({ corp }) {
  const c = CORPS[corp];
  if (!c) return null;
  return (
    <span style={{
      width: 28, height: 28, borderRadius: 8, background: c.color + "15",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: c.color, fontFamily: "monospace",
      flexShrink: 0,
    }}>{c.icon}</span>
  );
}
