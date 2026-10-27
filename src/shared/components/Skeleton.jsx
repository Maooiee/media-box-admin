// Loading placeholders. These mirror the real surfaces (card radius, border,
// spacing) so pages don't jump when data arrives.

export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return <div className={`skeleton ${rounded} ${className}`} />;
}

export function SkeletonStat() {
  return (
    <div className="surface-card flex items-center gap-2.5 p-2.5 md:px-3.5 md:py-3">
      <Skeleton className="h-8 w-8 shrink-0 md:h-9 md:w-9" rounded="rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-t border-border/70 px-4 py-3.5">
      <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-40 max-w-[45%]" />
        <Skeleton className="h-2.5 w-24 max-w-[30%]" />
      </div>
      <Skeleton className="hidden h-3 w-20 md:block" />
      <Skeleton className="h-6 w-16" rounded="rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/70 bg-primary-light/20 px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface-card space-y-3 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" rounded="rounded-xl" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="surface-card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
