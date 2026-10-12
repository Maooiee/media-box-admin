export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return <div className={`skeleton ${rounded} ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl p-5 border border-border space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" rounded="rounded-2xl" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 border-t border-border">
      <Skeleton className="w-9 h-9" rounded="rounded-full" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-3 w-20 ml-auto" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-white rounded-2xl px-4 py-3 border border-border/60 space-y-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}