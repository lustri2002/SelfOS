"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "LOGOUT" });
    }

    window.location.replace("/auth/logout");
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={loggingOut}
      variant="danger"
      className="h-auto w-full justify-start rounded-none border-0 bg-transparent px-4 py-3.5 text-[15px] hover:bg-[var(--sb-hover)]"
      leadingIcon={loggingOut ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" /> : <LogOut className="h-[18px] w-[18px] shrink-0" />}
    >
      {loggingOut ? "Esco..." : "Esci"}
    </Button>
  );
}
