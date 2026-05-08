"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export default function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

  if (online) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-amber-600 text-white text-center text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 animate-slide-down">
      <WifiOff className="h-3.5 w-3.5" />
      Sei offline — le modifiche non verranno salvate
    </div>
  );
}
