# SelfOS — Setup Guide

## 1. Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Vai su **SQL Editor** ed esegui tutti i file in `supabase/migrations/` in ordine numerico
3. Verifica che le policy RLS siano attive sulle tabelle utente
4. Vai su **Authentication → Users** e crea manualmente il tuo account, oppure abilita un signup controllato per una demo
5. Vai su **Settings → API** e copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Variabili d'ambiente

```bash
cp .env.example .env.local
# Apri .env.local e incolla le chiavi Supabase
```

Per nascondere moduli non rilevanti nella tua installazione:

```bash
# Lascia vuoto per abilitare tutto
NEXT_PUBLIC_SELFOS_DISABLED_MODULES=education,finance

# In alternativa usa una allowlist
NEXT_PUBLIC_SELFOS_MODULES=notes,tasks,goals,fitness
```

## 3. Icone PWA

Crea la cartella `public/icons/` e aggiungi:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Puoi generarle da qualsiasi immagine con [maskable.app](https://maskable.app)

## 4. Avvio locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) — verrai reindirizzato al login.

## 5. Deploy su Vercel

```bash
npm i -g vercel
vercel
```

Aggiungi le variabili d'ambiente nel dashboard Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- eventuali `NEXT_PUBLIC_SELFOS_MODULES` o `NEXT_PUBLIC_SELFOS_DISABLED_MODULES`

## 6. Installazione come PWA su iPhone

1. Apri Safari e vai all'URL del tuo deploy
2. Tap su **Condividi** → **Aggiungi a schermata Home**
3. L'app apparirà come app nativa

## Sicurezza

- Nessuna route è accessibile senza sessione attiva (middleware + RLS)
- Se usi magic link con `shouldCreateUser: false`, funziona solo per utenti gia' creati in Supabase
- I dati sono cifrati a riposo (AES-256 default Supabase)
- Il Service Worker non cacha mai risposte API o dati personali

## Demo portfolio

- Usa un utente Supabase dedicato alla demo.
- Inserisci solo note, task, esami, workout e dati finanziari sintetici.
- Lascia non configurate le integrazioni opzionali che non vuoi mostrare: Strava, Twelve Data e AI.
- Prima degli screenshot controlla Settings, sidebar e dati visibili per evitare nomi, email o importi reali.
