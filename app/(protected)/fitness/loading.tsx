import { Skeleton } from "@/components/ui/Skeleton";

export default function FitnessLoading() {
  return (
    <div className="px-4 md:px-8 pt-5 md:pt-8 pb-24 md:pb-10 max-w-5xl mx-auto w-full">
      {/* Hero */}
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4"
          >
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>

      {/* Card list */}
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4"
          >
            <Skeleton className="h-5 w-40 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
