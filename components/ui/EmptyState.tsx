import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] text-[var(--sb-muted)] shadow-[var(--sb-shadow-sm)]">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-[var(--sb-text)]">{title}</p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--sb-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
