"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const NotificationWatcher = dynamic(() => import("./NotificationWatcher"), {
  ssr: false,
});

export default function NotificationWatcherLazy() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true));
      return () => window.cancelIdleCallback(id);
    }

    const id = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(id);
  }, []);

  return ready ? <NotificationWatcher /> : null;
}
