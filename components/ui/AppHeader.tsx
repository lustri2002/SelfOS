"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AppHeaderProps {
  /** Large iOS-style title (shown above the subtitle). */
  title: string;
  /** Optional subtitle or date line. */
  subtitle?: string;
  /** Optional back-link href (renders a chevron-left). */
  backHref?: string;
  /** Optional actions rendered on the right side of the compact bar. */
  trailing?: React.ReactNode;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** Hide the large title block (use just the sticky compact bar). */
  compactOnly?: boolean;
}

/**
 * iOS-style app header.
 *
 * Layout:
 *   ┌─ sticky glass bar (compact, always visible, safe-top aware)
 *   └─ large title block (scrolls away)
 *
 * Use at the top of every page for a consistent native feel.
 */
export default function AppHeader({
  title,
  subtitle,
  backHref,
  trailing,
  className,
  compactOnly = false,
}: AppHeaderProps) {
  return (
    <header className={cn("relative", className)}>
      {/* Sticky compact bar — glass, always visible */}
      <div
        className="sticky top-0 z-30 sb-glass border-b"
        style={{ borderColor: "var(--sb-glass-border)" }}
      >
        <div className="flex h-12 items-center justify-between px-3 md:px-5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {backHref && (
              <Link
                href={backHref}
                className="sb-focus sb-row flex items-center gap-0.5 -ml-1 min-h-9 pl-1 pr-2 text-[15px] font-medium text-[var(--sb-accent)] transition-colors hover:bg-[var(--sb-hover)] sb-press"
              >
                <ChevronLeft className="h-5 w-5" />
                Indietro
              </Link>
            )}
            {compactOnly && (
              <span className="truncate text-[15px] font-semibold text-[var(--sb-text)]">
                {title}
              </span>
            )}
          </div>
          {trailing && (
            <div className="flex items-center gap-1 shrink-0">{trailing}</div>
          )}
        </div>
      </div>

      {/* Large title block — scrolls with content */}
      {!compactOnly && (
        <div className="px-4 pb-3 pt-4 md:px-8 md:pb-4 md:pt-6">
          <h1 className="sb-title-lg">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--sb-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
