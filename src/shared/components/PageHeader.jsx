// Shared page banner. Every admin screen uses this so the eyebrow, title,
// action button, and optional filter row always line up the same way.
export default function PageHeader({
  brand = 'Media Box',
  section,
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}) {
  return (
    <header className="group relative rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-light/70 via-primary-light/20 to-white shadow-card">
      {/* Ambient glow + glass highlight — clipped to the banner only. The
          header itself must NOT use overflow-hidden, otherwise dropdowns
          rendered from the controls row (period picker, employee picker,
          date pickers, …) get clipped. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <span className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      </div>

      <div className="relative p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-3.5">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-brand transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3 md:h-11 md:w-11">
                <Icon size={18} className="md:hidden" />
                <Icon size={20} className="hidden md:block" />
              </div>
            )}
            <div className="min-w-0">
              {/* Eyebrow: brand · section */}
              <div className="mb-0.5 flex items-center gap-1.5 md:mb-1 md:gap-2">
                <span className="eyebrow truncate text-primary">{brand}</span>
                {section && (
                  <>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-textFaint" />
                    <span className="eyebrow truncate text-textLight">
                      {section}
                    </span>
                  </>
                )}
              </div>

              <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-textDark md:text-3xl">
                {title}
              </h1>

              {subtitle && (
                <p className="mt-0.5 truncate text-[11px] text-textMedium md:mt-1 md:text-sm">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Action slot — pass a button (or anything) */}
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {/* Optional controls row (filters, tabs, period pickers) */}
        {children && (
          <div className="mt-3 border-t border-primary/10 pt-3 md:mt-4 md:pt-3.5">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
