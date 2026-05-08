"use client";

import { Toaster as SonnerToaster } from "sonner";

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--sb-surface)",
          border: "1px solid var(--sb-border)",
          color: "var(--sb-text)",
          fontSize: "0.875rem",
        },
      }}
      richColors
      closeButton
    />
  );
}
