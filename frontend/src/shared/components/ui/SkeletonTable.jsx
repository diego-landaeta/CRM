import { cn } from '@/shared/lib/utils';

/**
 * SkeletonTable - Loader de tabla reutilizable.
 *
 * props:
 *  - rows: numero de filas (default 8)
 *  - columns: numero de columnas (default 5)
 */
export default function SkeletonTable({ rows = 8, columns = 5, className }) {
  return (
    <div
      className={cn(
        'bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden',
        className,
      )}
    >
      <div className="border-b bg-muted/50 px-5 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-muted rounded flex-1 animate-pulse" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-muted" />
            {Array.from({ length: columns - 1 }).map((_, j) => (
              <div key={j} className="h-4 bg-muted rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div
      className={cn(
        'bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] animate-pulse',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="w-12 h-5 rounded-full bg-muted" />
      </div>
      <div className="w-20 h-3 bg-muted rounded mb-2" />
      <div className="w-16 h-8 bg-muted rounded" />
    </div>
  );
}
