import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Skeleton className="h-7 w-32 mb-8" />

      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-6 p-5 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)]">
          <Skeleton className="h-5 w-28 mb-3" />
          <Skeleton className="h-4 w-64 mb-4" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}
