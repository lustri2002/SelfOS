import { Skeleton } from "@/components/ui/Skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sb-border)]">
        <Skeleton className="h-6 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Projects bar */}
      <div className="flex gap-2 px-6 py-3 border-b border-[var(--sb-border)]">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-6 py-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>

      {/* Task items */}
      <div className="flex-1 px-6 space-y-1">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-48 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
