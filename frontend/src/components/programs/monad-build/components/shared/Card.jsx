export default function Card({ children, className = '', onClick, gradient }) {
  const classes = [
    'mb-card',
    onClick ? 'clickable' : '',
    gradient ? 'mb-card-gradient' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}
