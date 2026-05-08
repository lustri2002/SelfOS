"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";

export default function ServiceWorkerRegister() {
  const onUpdate = useCallback((registration: ServiceWorkerRegistration) => {
    toast("Aggiornamento disponibile", {
      description: "Una nuova versione e pronta.",
      action: {
        label: "Aggiorna",
        onClick: () => {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        },
      },
      duration: Infinity,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let interval: number | null = null;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates every 30 minutes
        interval = window.setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);

        // Detect waiting worker (new version ready)
        if (registration.waiting) {
          onUpdate(registration);
          return;
        }

        // Detect when a new worker is installed
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              onUpdate(registration);
            }
          });
        });

      })
      .catch(() => {
        // SW registration failed — not critical, app works without it
      });

    return () => {
      if (interval) window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [onUpdate]);

  return null;
}
