export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  const base = `
    group
    inline-flex items-center justify-center gap-2 font-semibold rounded-full
    transition-all duration-200 ease-out
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
    hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2
  `;

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    primary: `
      bg-gradient-to-br from-primary to-primary-dark text-white
      shadow-md shadow-primary/25
      hover:shadow-lg hover:shadow-primary/35
    `,
    outline: `
      border border-border text-textDark bg-white
      hover:border-primary/40 hover:bg-primary-light/20 hover:text-primary
      hover:shadow-sm
    `,
    ghost: `
      text-textMedium hover:text-textDark hover:bg-bg
    `,
    danger: `
      bg-gradient-to-br from-red-500 to-red-600 text-white
      shadow-md shadow-red-500/25
      hover:shadow-lg hover:shadow-red-500/35
    `,
  };

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon && (
        <Icon
          size={iconSize}
          className="shrink-0 transition-transform duration-200 group-hover:scale-110"
        />
      )}
      {children}
    </button>
  );
}