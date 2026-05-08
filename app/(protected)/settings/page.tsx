import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import ExportButton from "@/components/ui/ExportButton";
import ThemeToggle from "@/components/ui/ThemeToggle";
import DisplayNameEditor from "@/components/ui/DisplayNameEditor";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import AppHeader from "@/components/ui/AppHeader";
import { Panel } from "@/components/ui/Panel";
import { Activity, Trash2, HelpCircle, ChevronRight } from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";
import { APP_MODULES, isModuleEnabled } from "@/config/modules";

const mobileLinks = [
  { href: "/fitness", icon: Activity, label: "Fitness", tint: "text-emerald-400", enabled: isModuleEnabled("fitness") },
  { href: "/trash", icon: Trash2, label: "Cestino", tint: "text-rose-400" },
  { href: "/help", icon: HelpCircle, label: "Guida", tint: "text-indigo-400" },
].filter((item) => item.enabled !== false);

export default async function SettingsPage() {
  const user = await requireUser();

  const displayName = (user?.user_metadata?.display_name as string) || "";

  return (
    <>
      <AppHeader title="Impostazioni" />

      <div className="sb-page max-w-xl">
        <div className="space-y-5">
          {/* Quick links — mobile only, iOS-style grouped list */}
          <section className="md:hidden">
            <h2 className="sb-eyebrow px-3 mb-2">Naviga</h2>
            <ul className="sb-group">
              {mobileLinks.map(({ href, icon: Icon, label, tint }, i) => (
                <li
                  key={href}
                  className={
                    i < mobileLinks.length - 1
                      ? "border-b border-[var(--sb-border)]"
                      : ""
                  }
                >
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-4 py-3.5 text-[15px] text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors sb-press"
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${tint}`} />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="h-4 w-4 text-[var(--sb-faint)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Account */}
          <section>
            <h2 className="sb-eyebrow px-3 mb-2">Account</h2>
            <Panel className="p-4">
              <DisplayNameEditor
                initialName={displayName}
                email={user?.email ?? ""}
              />
            </Panel>
          </section>

          {/* Aspetto */}
          <section>
            <h2 className="sb-eyebrow px-3 mb-2">Aspetto</h2>
            <Panel className="p-4">
              <ThemeToggle />
            </Panel>
          </section>

          {/* Moduli */}
          <section>
            <h2 className="sb-eyebrow px-3 mb-2">Moduli attivi</h2>
            <Panel className="divide-y divide-[var(--sb-border)] overflow-hidden">
              {APP_MODULES.map((module) => {
                const enabled = isModuleEnabled(module.id);
                return (
                  <div key={module.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? "bg-emerald-400" : "bg-[var(--sb-faint)]"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--sb-text)]">{module.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--sb-muted)]">{module.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-[var(--sb-muted)]">
                      {enabled ? "Attivo" : "Disattivo"}
                    </span>
                  </div>
                );
              })}
            </Panel>
            <p className="mt-2 px-3 text-[11px] leading-relaxed text-[var(--sb-muted)]">
              Per questa versione self-hosted i moduli si configurano con `NEXT_PUBLIC_SELFOS_MODULES` o `NEXT_PUBLIC_SELFOS_DISABLED_MODULES`.
            </p>
          </section>

          {/* Notifiche */}
          <section>
            <h2 className="sb-eyebrow px-3 mb-2">Notifiche PWA</h2>
            <Panel className="p-4">
              <NotificationSettings />
            </Panel>
          </section>

          {/* Backup */}
          <section>
            <h2 className="sb-eyebrow px-3 mb-2">Backup dati</h2>
            <Panel className="p-4 space-y-3">
              <p className="text-[13px] text-[var(--sb-muted)] leading-relaxed">
                Esporta tutti i tuoi dati in formato JSON. Il file viene
                generato interamente nel browser.
              </p>
              <ExportButton />
            </Panel>
          </section>

          {/* Logout — mobile only */}
          <section className="md:hidden">
            <div className="sb-group">
              <LogoutButton />
            </div>
          </section>

          {/* Footer attribution */}
          <p className="text-center text-[11px] text-[var(--sb-faint)] pt-4">
            SelfOS · Workspace modulare self-hosted
          </p>
        </div>
      </div>
    </>
  );
}
