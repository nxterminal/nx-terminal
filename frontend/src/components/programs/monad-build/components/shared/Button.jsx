export default function Button({ children, variant = 'primary', size, icon, className = '', ...props }) {
  const classes = [
    'mb-btn',
    `mb-btn-${variant}`,
    size === 'sm' ? 'mb-btn-sm' : '',
    icon && !children ? 'mb-btn-icon' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
