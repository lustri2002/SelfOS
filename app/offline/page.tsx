"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--sb-bg)]">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--sb-surface)] border border-[var(--sb-border)]">
          <WifiOff className="h-8 w-8 text-[var(--sb-muted)]" />
        </div>

        <h1 className="text-xl font-semibold text-[var(--sb-text)] mb-2">
          Sei offline
        </h1>
        <p className="text-sm text-[var(--sb-muted)] mb-8 leading-relaxed">
          SelfOS ha bisogno di una connessione internet per
          sincronizzare i tuoi dati. Verifica la connessione e riprova.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Riprova
        </button>
      </div>
    </main>
  );
}
