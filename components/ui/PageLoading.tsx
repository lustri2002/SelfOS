import { Skeleton } from "@/components/ui/Skeleton";

interface PageLoadingProps {
  titleWidth?: string;
  subtitleWidth?: string;
  rows?: number;
  cards?: number;
}

export default function PageLoading({
  titleWidth = "w-44",
  subtitleWidth = "w-72",
  rows = 5,
  cards = 3,
}: PageLoadingProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-2">
          <div className="h-full w-full animate-spin rounded-full border-2 border-[var(--sb-border)] border-t-[var(--sb-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className={`mb-2 h-7 ${titleWidth}`} />
          <Skeleton className={`h-4 max-w-full ${subtitleWidth}`} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4"
          >
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4"
          >
            <Skeleton className="mb-2 h-4 w-2/3 max-w-80" />
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
