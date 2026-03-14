export default function Tooltip({ children, label }) {
  return (
    <div className="mb-tooltip-wrap">
      {children}
      <div className="mb-tooltip">{label}</div>
    </div>
  );
}
