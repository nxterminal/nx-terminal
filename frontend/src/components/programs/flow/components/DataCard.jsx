export default function DataCard({ title, children, className = '' }) {
  return (
    <div className={`flow-data-card ${className}`}>
      {title && <div className="flow-data-card__title">{title}</div>}
      {children}
    </div>
  );
}
