"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { isNotificationSupported, NOTIFICATION_ENABLED_KEY, showAppNotification } from "@/components/notifications/notify";

type PermissionState = NotificationPermission | "unsupported";

export default function NotificationSettings() {
  const [hydrated, setHydrated] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setHydrated(true);
      setPermission(isNotificationSupported() ? Notification.permission : "unsupported");
      setEnabled(localStorage.getItem(NOTIFICATION_ENABLED_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  async function enable() {
    if (!isNotificationSupported()) {
      toast.error("Le notifiche non sono supportate da questo browser");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== "granted") {
      toast.error("Permesso notifiche non concesso");
      return;
    }

    localStorage.setItem(NOTIFICATION_ENABLED_KEY, "true");
    setEnabled(true);
    toast.success("Notifiche attivate");
    await showAppNotification("SelfOS", {
      body: "Notifiche attive. Ti avviserò per promemoria e scadenze quando l'app è disponibile.",
      tag: "sb-notifications-enabled",
      data: { url: "/home" },
    });
  }

  function disable() {
    localStorage.setItem(NOTIFICATION_ENABLED_KEY, "false");
    setEnabled(false);
    toast("Notifiche locali disattivate");
  }

  async function test() {
    const sent = await showAppNotification("Notifica di prova", {
      body: "Se la vedi, la PWA può mostrare notifiche su questo dispositivo.",
      tag: "sb-test-notification",
      data: { url: "/settings" },
    });

    if (!sent) toast.error("Attiva prima le notifiche");
  }

  if (!hydrated || permission === "unsupported") {
    return (
      <div className="flex items-start gap-3 text-[13px] text-[var(--sb-muted)]">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Questo browser non espone le notifiche PWA. Su iOS serve installare l&apos;app nella schermata Home.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 text-[13px] text-[var(--sb-muted)]">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sb-accent)]" />
        <p>
          Avvisi locali per promemoria note, task scaduti, spese ricorrenti ed esami prenotati. Le notifiche vengono controllate quando la PWA è aperta o viene riaperta.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {enabled && permission === "granted" ? (
          <Button variant="subtle" onClick={disable} leadingIcon={<BellOff className="h-4 w-4" />}>
            Disattiva
          </Button>
        ) : (
          <Button variant="default" onClick={enable} leadingIcon={<Bell className="h-4 w-4" />}>
            Attiva notifiche
          </Button>
        )}
        <Button variant="subtle" onClick={test} leadingIcon={<Send className="h-4 w-4" />}>
          Invia prova
        </Button>
      </div>
      <p className="text-[11px] text-[var(--sb-faint)]">
        Stato browser: {permission}. Stato app: {enabled ? "attive" : "non attive"}.
      </p>
    </div>
  );
}
