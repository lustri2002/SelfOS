"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, TrendingUp, Settings, Trash2,
  LogOut, HelpCircle, CheckSquare, Activity, MoreHorizontal, Loader2,
  GraduationCap, Target, Zap, LayoutDashboard, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_BRAND, getEnabledModules, type AppModuleId } from "@/config/modules";

const moduleIcons = {
  notes: BookOpen,
  tasks: CheckSquare,
  goals: Target,
  finance: TrendingUp,
  fitness: Activity,
  education: GraduationCap,
  automation: Zap,
} satisfies Record<AppModuleId, typeof Home>;

const enabledModules = getEnabledModules();

const navGroups = [
  {
    label: "Command",
    items: [
      { href: "/home", icon: Home, label: "Home", module: "sb-module-system" },
      { href: "/command", icon: LayoutDashboard, label: "Command Center", module: "sb-module-system" },
    ],
  },
  {
    label: "Aree",
    items: enabledModules
      .filter((module) => module.id !== "automation")
      .map((module) => ({
        href: module.href,
        icon: moduleIcons[module.id],
        label: module.label,
        module: module.moduleClass,
      })),
  },
  {
    label: "Sistema",
    items: [
      ...enabledModules
        .filter((module) => module.id === "automation")
        .map((module) => ({
          href: module.href,
          icon: moduleIcons[module.id],
          label: module.label,
          module: module.moduleClass,
        })),
      { href: "/trash", icon: Trash2, label: "Cestino", module: "sb-module-system" },
      { href: "/help", icon: HelpCircle, label: "Guida", module: "sb-module-system" },
      { href: "/settings", icon: Settings, label: "Impostazioni", module: "sb-module-system" },
    ],
  },
];

const mobilePrimaryItems = [
  { href: "/command", icon: LayoutDashboard, label: "Command" },
  ...enabledModules
    .filter((module) => ["goals", "tasks", "finance"].includes(module.id))
    .map((module) => ({ href: module.href, icon: moduleIcons[module.id], label: module.shortLabel })),
];

// Inline style — Tailwind 4 @layer overrides classes on <a>
const navItemStyle: React.CSSProperties = {
  display: "flex",
  flex: "1 1 0%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 58,
  paddingTop: 7,
  paddingBottom: 7,
  fontSize: 10.5,
  lineHeight: 1,
  textDecoration: "none",
  position: "relative",
  WebkitTapHighlightColor: "transparent",
  transition: "color 160ms ease, transform 160ms cubic-bezier(0.32, 0.72, 0, 1)",
};

const pillStyle: React.CSSProperties = {
  position: "absolute",
  top: 5,
  width: 46,
  height: 32,
  borderRadius: 8,
  background: "var(--sb-accent-soft)",
  transition: "opacity 180ms ease",
};

export default function Sidebar() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryActive = mobilePrimaryItems.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "LOGOUT" });
    }

    window.location.replace("/auth/logout");
  }

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <aside className="hidden h-full w-68 shrink-0 flex-col border-r border-[var(--sb-border)] bg-[color-mix(in_srgb,var(--sb-surface)_86%,var(--sb-bg))] md:flex">
        <div className="border-b border-[var(--sb-border)] px-4 py-4">
          <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-[var(--sb-shadow-sm)]"
          >
            <Image src="/icons/icon.svg" alt="" width={28} height={28} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-[var(--sb-text)]">
              {APP_BRAND.name}
            </p>
            <p className="text-[11px] text-[var(--sb-muted)]">Workspace modulare privato</p>
          </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-[var(--sb-faint)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ href, icon: Icon, label, module }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        module,
                        "sb-focus sb-row group relative flex min-h-10 cursor-pointer items-center gap-3 overflow-hidden px-3 py-2 text-[13px] transition-all sb-press",
                        active
                          ? "bg-[color-mix(in_srgb,var(--module-color)_16%,transparent)] font-semibold text-[var(--sb-text)] shadow-[var(--sb-shadow-sm)]"
                          : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 h-6 w-1 rounded-r-full bg-[var(--module-color)]" />
                      )}
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition-colors", active ? "bg-[color-mix(in_srgb,var(--module-color)_18%,transparent)] text-[var(--module-color)]" : "bg-transparent")}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      <span className="flex-1">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--sb-border)] p-2">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="sb-focus sb-row flex min-h-10 w-full cursor-pointer items-center gap-3 px-3 py-2 text-[13px] text-[var(--sb-muted)] transition-all hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] disabled:cursor-not-allowed disabled:opacity-60 sb-press"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
            {loggingOut ? "Esco..." : "Esci"}
          </button>
        </div>
      </aside>

      {/* ── Mobile module launcher ───────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu moduli">
          <button
            type="button"
            aria-label="Chiudi menu"
            className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-lg border-t border-[var(--sb-border)] bg-[var(--sb-bg)] shadow-[var(--sb-shadow-lg)]">
            <div className="flex items-center justify-between border-b border-[var(--sb-border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)]">
                  <Image src="/icons/icon.svg" alt="" width={24} height={24} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--sb-text)]">SelfOS</p>
                  <p className="text-[11px] text-[var(--sb-muted)]">Launcher moduli</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Chiudi menu"
                onClick={() => setMobileMenuOpen(false)}
                className="sb-focus flex h-10 w-10 items-center justify-center rounded-lg text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(82dvh-4rem)] overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-4">
              {navGroups.map((group) => (
                <div key={group.label} className="mb-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase text-[var(--sb-faint)]">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(({ href, icon: Icon, label, module }) => {
                      const active = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            module,
                            "sb-focus sb-row flex min-h-14 items-center gap-3 border px-3 py-2 sb-press",
                            active
                              ? "border-[color-mix(in_srgb,var(--module-color)_38%,var(--sb-border))] bg-[color-mix(in_srgb,var(--module-color)_16%,transparent)] text-[var(--sb-text)]"
                              : "border-[var(--sb-border)] bg-[var(--sb-surface)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                          )}
                        >
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-[color-mix(in_srgb,var(--module-color)_18%,transparent)] text-[var(--module-color)]" : "bg-[var(--sb-card)]")}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                aria-busy={loggingOut}
                className="sb-focus sb-row flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-2 text-sm text-[var(--sb-muted)] transition-all hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] disabled:cursor-not-allowed disabled:opacity-60 sb-press"
              >
                {loggingOut ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
                {loggingOut ? "Esco..." : "Esci"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav (primary tabs + launcher) ──────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t sb-glass md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {mobilePrimaryItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                ...navItemStyle,
                color: active ? "var(--sb-accent)" : "var(--sb-muted)",
                fontWeight: active ? 600 : 500,
                transform: active ? "translateY(-1px)" : "none",
              }}
            >
              {active && (
                <span
                  aria-hidden
                  style={pillStyle}
                />
              )}
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} style={{ position: "relative", zIndex: 1 }} />
              <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Apri tutti i moduli"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
          style={{
            ...navItemStyle,
            border: 0,
            background: "transparent",
            color: mobileMenuOpen || !primaryActive ? "var(--sb-accent)" : "var(--sb-muted)",
            fontWeight: mobileMenuOpen || !primaryActive ? 600 : 500,
            transform: mobileMenuOpen || !primaryActive ? "translateY(-1px)" : "none",
          }}
        >
          {(mobileMenuOpen || !primaryActive) && (
            <span aria-hidden style={pillStyle} />
          )}
          <MoreHorizontal size={22} strokeWidth={mobileMenuOpen || !primaryActive ? 2.2 : 1.8} style={{ position: "relative", zIndex: 1 }} />
          <span style={{ position: "relative", zIndex: 1 }}>Menu</span>
        </button>
      </nav>
    </>
  );
}
