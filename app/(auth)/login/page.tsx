"use client";

import { useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Mail,
  ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [magicSent, setMagicSent] = useState(false);

  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const supabase = createClient();

  function handleAuthEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes("rate") || error.status === 429) {
          setError("Troppi tentativi. Attendi qualche minuto e riprova.");
        } else {
          setError("Accesso non autorizzato.");
        }
      } else {
        setMagicSent(true);
      }
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  const displayError = error || (urlError === "invalid" ? "Email o password errati." : urlError === "missing" ? "Inserisci email e password." : null);

  return (
    <main className="sb-app-shell flex min-h-[100dvh] items-center justify-center p-4 safe-top safe-bottom md:p-8">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--sb-surface)_88%,transparent)] shadow-[var(--sb-shadow-lg)] backdrop-blur-xl md:grid-cols-[0.95fr_1fr]">
        <div className="hidden flex-col justify-between bg-[linear-gradient(145deg,rgba(10,132,255,0.18),rgba(16,17,22,0.42)_48%,rgba(16,185,129,0.12))] p-8 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white/10 shadow-[var(--sb-shadow-sm)]">
                <Image src="/icons/icon-192.png" alt="SelfOS" width={48} height={48} priority className="h-full w-full" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--sb-text)]">SelfOS</p>
                <p className="text-xs text-[var(--sb-muted)]">Workspace modulare privato</p>
              </div>
            </div>

            <div className="mt-16">
              <h1 className="text-4xl font-bold leading-[1.05] text-[var(--sb-text)]">
                SelfOS: il tuo workspace modulare.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-[var(--sb-muted)]" style={{ paddingTop: "0.2em", paddingBottom: "1.2em" }}>
                Note, task, finanze, fitness ed education in un unico ambiente operativo.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { icon: Sparkles, label: "Focus", text: "Priorita e contesto sempre a portata." },
              { icon: ShieldCheck, label: "Privato", text: "Accesso protetto ai tuoi dati." },
              { icon: Zap, label: "Rapido", text: "Pensato per l'uso quotidiano." },
            ].map(({ icon: Icon, label, text }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-white/[0.045] px-3 py-2.5">
                <Icon className="h-4 w-4 text-[var(--sb-accent)]" />
                <div>
                  <p className="text-xs font-semibold text-[var(--sb-text)]">{label}</p>
                  <p className="text-[11px] text-[var(--sb-muted)]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-9">
          <div className="mb-7 text-center md:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-[var(--sb-card)] shadow-[var(--sb-shadow-sm)]">
              <Image src="/icons/icon-192.png" alt="SelfOS" width={56} height={56} priority className="h-full w-full" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--sb-text)]">SelfOS</h1>
            <p className="mt-1 text-sm text-[var(--sb-muted)]">Accesso privato</p>
          </div>

          <div className="mb-6 hidden md:block">
            <p className="text-xs font-semibold uppercase text-[var(--sb-muted)]">Accesso privato</p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--sb-text)]">Bentornato</h2>
            <p className="mt-2 text-sm text-[var(--sb-muted)]">Accedi al tuo workspace modulare.</p>
          </div>

          {magicSent ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              </div>
              <p className="text-base font-semibold text-[var(--sb-text)]">Link inviato</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--sb-muted)]">
                Controlla la tua email per completare l&apos;accesso.
              </p>
              <Button
                onClick={() => setMagicSent(false)}
                variant="ghost"
                size="sm"
                className="mt-4"
                leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Torna al login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-[var(--sb-card)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mode === "password" ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]"}`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("magic");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mode === "magic" ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]"}`}
                >
                  Magic link
                </button>
              </div>

              <form
                action={mode === "password" ? "/auth/login" : undefined}
                method={mode === "password" ? "POST" : undefined}
                onSubmit={mode === "password" ? undefined : handleMagicLink}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[var(--sb-muted)]">
                    Email
                  </label>
                  <TextField
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleAuthEnter}
                    disabled={loading}
                    placeholder="nome@esempio.com"
                  />
                </div>

                {mode === "password" && (
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[var(--sb-muted)]">
                      Password
                    </label>
                    <TextField
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleAuthEnter}
                      disabled={loading}
                      placeholder="••••••••"
                    />
                  </div>
                )}

                {displayError && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {displayError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  variant="default"
                  className="w-full"
                  leadingIcon={
                    loading && mode === "magic"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : mode === "password"
                        ? <LockKeyhole className="h-4 w-4" />
                        : <Mail className="h-4 w-4" />
                  }
                >
                  {loading && mode === "magic"
                    ? "Invio..."
                    : mode === "password"
                      ? "Accedi"
                      : "Invia link di accesso"}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
