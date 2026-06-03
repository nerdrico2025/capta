import { Skeleton } from '@/components/ui/Skeleton';

export function OpportunityCardSkeleton() {
  return (
    <div
      className="shadow-card flex flex-col rounded-2xl border border-gray-100 bg-white p-5"
      aria-hidden
    >
      {/* Badge row */}
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>

      {/* Title */}
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Deadline + value */}
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-5 w-20" />
      </div>

      {/* Area chips */}
      <div className="mb-4 flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      {/* CTA */}
      <div className="mt-auto border-t border-gray-100 pt-4">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function OpportunityGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <OpportunityCardSkeleton key={i} />
      ))}
    </div>
  );
}
