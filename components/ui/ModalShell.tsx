"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function ModalShell({
  title,
  onClose,
  children,
  className,
  contentClassName,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "sb-mobile-modal w-full max-w-md rounded-t-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] p-5 shadow-xl safe-bottom md:rounded-lg",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--sb-text)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="sb-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}
