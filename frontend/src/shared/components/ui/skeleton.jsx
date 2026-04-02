import { cn } from '@/shared/lib/utils';

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-muted', className)}
      {...props}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full mt-2" />
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-card rounded-3xl border border-border overflow-hidden">
      <div className="p-5 flex justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="border-t">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
            <Skeleton className="h-7 w-7 rounded-full" />
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[140px]' : 'max-w-[100px]'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonKpis({ count = 4 }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-3xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonKpis };
