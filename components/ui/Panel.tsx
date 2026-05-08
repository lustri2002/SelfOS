import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sb-panel",
        className,
      )}
      {...props}
    />
  );
}

export function DialogPanel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-lg)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
