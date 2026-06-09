import { Skeleton } from "@/components/ui/skeleton";

/**
 * Modern, content-shaped skeleton used as the route-level Suspense fallback.
 * Instead of a blank screen or a lone spinner (which feels slow, especially in
 * the mobile WebView), this paints the rough shape of a page immediately so the
 * load feels instant.
 */
export default function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-5" aria-busy="true" aria-label="Loading">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>

      {/* Stat row */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Content cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-border/40">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
