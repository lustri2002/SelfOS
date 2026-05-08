import { Skeleton } from "@/components/ui/Skeleton";

export default function NotesLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sb-border)]">
        <Skeleton className="h-6 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      {/* Notebook chips */}
      <div className="flex gap-2 px-6 pb-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      {/* Note items */}
      <div className="flex-1 px-6 space-y-1.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-52 mb-2" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
