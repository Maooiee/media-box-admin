export default function PageHeader({
  brand = 'Media Box',
  section,
  title,
  subtitle,
  icon: Icon,
  action,
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-light/70 via-primary-light/25 to-transparent border border-primary/10 shadow-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {Icon && (
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-brand shrink-0">
              <Icon size={18} className="md:hidden" />
              <Icon size={20} className="hidden md:block" />
            </div>
          )}
          <div className="min-w-0">
            {/* Eyebrow: brand · section */}
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-primary uppercase truncate">
                {brand}
              </span>
              {section && (
                <>
                  <span className="w-1 h-1 rounded-full bg-textFaint shrink-0" />
                  <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-textLight uppercase truncate">
                    {section}
                  </span>
                </>
              )}
            </div>
            {/* Title */}
            <h1 className="text-xl md:text-3xl font-bold text-textDark tracking-tight leading-tight truncate">
              {title}
            </h1>
            {/* Subtitle */}
            {subtitle && (
              <p className="text-[11px] md:text-sm text-textMedium mt-0.5 md:mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action slot — pass a button (or anything) */}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}