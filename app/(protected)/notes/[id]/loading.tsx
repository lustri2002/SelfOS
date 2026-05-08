import { Skeleton } from "@/components/ui/Skeleton";

export default function NoteEditorLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sb-border)] bg-[var(--sb-surface)]">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--sb-border)] bg-[var(--sb-surface)]">
        {[...Array(14)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-7 rounded" />
        ))}
      </div>

      {/* Title */}
      <div className="px-8 md:px-12 pt-8 pb-1">
        <Skeleton className="h-9 w-80" />
      </div>

      {/* Notebook picker */}
      <div className="px-8 md:px-12 pt-2 pb-1">
        <Skeleton className="h-6 w-36 rounded-md" />
      </div>

      {/* Tags */}
      <div className="flex gap-1.5 px-8 md:px-12 py-3">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>

      {/* Content lines */}
      <div className="px-8 md:px-12 py-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
