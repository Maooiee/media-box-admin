// Card with a compact header. Replaces the slightly different card shells
// that were repeated across dashboard pages.
export default function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  tone = 'default',
  className = '',
  bodyClassName = '',
  children,
}) {
  const headerTone =
    tone === 'warn'
      ? 'bg-yellowLight/50 border-yellow/25 text-yellow'
      : tone === 'brand'
        ? 'bg-primary-light/40 border-primary/15 text-primary'
        : 'bg-white border-border/70 text-primary';

  return (
    <section
      className={`surface-card overflow-hidden ${
        tone === 'warn' ? 'border-yellow/25' : ''
      } ${className}`}
    >
      {(title || action) && (
        <header
          className={`flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5 md:py-3.5 ${headerTone}`}
        >
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            {Icon && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-current shadow-sm md:h-8 md:w-8">
                <Icon size={14} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-xs font-bold text-textDark md:text-sm">
                {title}
              </h3>
              {subtitle && (
                <p className="truncate text-[10px] text-textLight">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName || 'p-4 md:p-5'}>{children}</div>
    </section>
  );
}
