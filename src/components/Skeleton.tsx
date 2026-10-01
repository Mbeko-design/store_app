/** Static skeleton blocks (no decorative animation) for loading states. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-40" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="mt-3 h-3 w-full" />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-line bg-card divide-y divide-line" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Screen-reader friendly loading message paired with skeletons. */
export function LoadingBlock({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div role="status" className="sr-only">
      {label}
    </div>
  );
}
