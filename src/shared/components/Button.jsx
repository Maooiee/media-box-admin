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
    inline-flex items-center justify-center gap-2 font-semibold rounded-full
    transition-all duration-200 ease-out
    disabled:opacity-50 disabled:cursor-not-allowed
    hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
  `;

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    primary: `
      bg-primary text-white
      shadow-md shadow-primary/20
      hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/30
    `,
    outline: `
      border border-border text-textDark bg-white
      hover:border-primary/40 hover:bg-bg hover:shadow-sm
    `,
    ghost: `
      text-textMedium hover:text-textDark hover:bg-bg
    `,
    danger: `
      bg-red-500 text-white
      shadow-md shadow-red-500/20
      hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30
    `,
  };

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon && (
        <Icon
          size={iconSize}
          className="transition-transform duration-200 group-hover:scale-110"
        />
      )}
      {children}
    </button>
  );
}