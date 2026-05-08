import { Skeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Greeting */}
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-96 mb-8" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>

      {/* Pinned */}
      <Skeleton className="h-5 w-32 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Recent */}
      <Skeleton className="h-5 w-28 mb-3" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1.5" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
