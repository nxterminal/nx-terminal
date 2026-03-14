export default function Badge({ children, color = 'purple', className = '' }) {
  return (
    <span className={`mb-badge mb-badge-${color} ${className}`}>
      {children}
    </span>
  );
}
