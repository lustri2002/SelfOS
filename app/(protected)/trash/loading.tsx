import { Skeleton } from "@/components/ui/Skeleton";

export default function TrashLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Skeleton className="h-7 w-24 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />

      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
            <div>
              <Skeleton className="h-4 w-44 mb-2" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
