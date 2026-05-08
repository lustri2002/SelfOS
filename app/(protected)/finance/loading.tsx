import { Skeleton } from "@/components/ui/Skeleton";

export default function FinanceLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Skeleton className="h-7 w-24 mb-6" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b border-[var(--sb-border)]">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-[var(--sb-border)] last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
