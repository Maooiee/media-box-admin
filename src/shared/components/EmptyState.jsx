// One empty state for the whole app so "nothing here" screens feel
// intentional instead of unfinished.
export default function EmptyState({
  icon: Icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div className={`empty-surface ${className}`}>
      <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
      <span className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-primary/[0.04] blur-2xl" />

      <div className="relative">
        {Icon && (
          <div className="empty-icon">
            <Icon size={26} className="md:hidden" />
            <Icon size={34} className="hidden md:block" />
          </div>
        )}
        <h3 className="text-base font-bold text-textDark md:text-lg">{title}</h3>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-textLight md:text-sm">
            {description}
          </p>
        )}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
