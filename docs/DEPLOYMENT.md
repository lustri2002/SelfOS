# SelfOS — Guida Tecnica al Deployment

> Documento tecnico per il deployment in produzione della PWA e la configurazione dei provider AI.

---

## Indice

1. [Architettura di deployment](#1-architettura-di-deployment)
2. [Prerequisiti](#2-prerequisiti)
3. [Configurazione Supabase (Database)](#3-configurazione-supabase-database)
4. [Deployment su Vercel (raccomandato)](#4-deployment-su-vercel-raccomandato)
5. [Deployment su VPS / self-hosted (alternativa)](#5-deployment-su-vps--self-hosted-alternativa)
6. [Checklist di sicurezza per la produzione](#6-checklist-di-sicurezza-per-la-produzione)
7. [Dominio e HTTPS](#7-dominio-e-https)
8. [Configurazione dei provider AI](#8-configurazione-dei-provider-ai)
9. [Backup e disaster recovery](#9-backup-e-disaster-recovery)
10. [Monitoraggio](#10-monitoraggio)

---

## 1. Architettura di deployment

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                 │  HTTPS  │                  │  HTTPS  │                  │
│   Browser /     │ ◄─────► │   Next.js App    │ ◄─────► │   Supabase       │
│   PWA installata│         │   (SSR + API)    │         │   (Postgres+Auth)│
│                 │         │                  │         │                  │
└─────────────────┘         └────────┬─────────┘         └──────────────────┘
                                     │ HTTPS
                                     ▼
                            ┌──────────────────┐
                            │   AI Provider    │
                            │   (Anthropic /   │
                            │    OpenAI)       │
                            └──────────────────┘
```

**Componenti:**

| Componente | Ruolo | Dati sensibili gestiti |
|---|---|---|
| **Next.js App** | Server-side rendering, API routes, middleware auth | Chiavi API (env vars), cookie di sessione |
| **Supabase** | Database PostgreSQL, autenticazione, Row Level Security | Tutti i dati utente (note, finanze, fitness) |
| **AI Provider** | Analisi screenshot, generazione piani allenamento | Immagini inviate per analisi (non persistite) |

---

## 2. Prerequisiti

- **Node.js** >= 20.x
- **Account Supabase** (free tier sufficiente per uso personale)
- **Account Vercel** (free tier sufficiente) oppure un VPS con almeno 1 GB RAM
- **Dominio personale** (fortemente raccomandato per HSTS e cookie sicuri)
- **Chiave API** per almeno un provider AI (Anthropic o OpenAI)

---

## 3. Configurazione Supabase (Database)

### 3.1 — Creare il progetto

1. Vai su [supabase.com](https://supabase.com) → **New Project**
2. Scegli la **regione piu vicina** a te (es. `eu-central-1` per l'Italia)
3. Imposta una **database password sicura** (min. 20 caratteri, generata casualmente)
4. Annota:
   - `Project URL` → diventa `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → diventa `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.2 — Eseguire le migrazioni

Apri il **SQL Editor** nella dashboard Supabase ed esegui i file di migrazione **in ordine**:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_pinned_notes.sql
supabase/migrations/003_shared_notes.sql
supabase/migrations/004_note_versions.sql
supabase/migrations/005_soft_delete_and_templates.sql
supabase/migrations/006_reminders_colors_nested_notebooks.sql
supabase/migrations/007_task_manager.sql
supabase/migrations/008_shared_projects.sql
supabase/migrations/009_monthly_income.sql
supabase/migrations/010_monthly_notes_finance.sql
supabase/migrations/011_fitness_habits.sql
supabase/migrations/012_training_plans.sql
supabase/migrations/013_planned_workouts.sql
supabase/migrations/014_body_metrics.sql
supabase/migrations/015_body_metrics_height.sql
```

### 3.3 — Sicurezza del database

**Row Level Security (RLS)** e gia abilitata su tutte le tabelle. Ogni policy usa `auth.uid() = user_id`, il che garantisce che un utente autenticato possa accedere **solo ai propri dati**.

Impostazioni critiche nella dashboard Supabase:

| Impostazione | Dove | Valore |
|---|---|---|
| **Disabilita signup pubblico** | Authentication → Settings | Se non vuoi che altri si registrino, disattiva "Enable sign up" |
| **Email confirmation** | Authentication → Settings | Attiva se lasci la registrazione aperta |
| **JWT expiry** | Authentication → Settings | Lascia il default (3600s) o abbassalo a 1800s |
| **API key exposure** | Settings → API | L'`anon key` e sicura da esporre (RLS la limita). **NON esporre MAI la `service_role key`** |

### 3.4 — Creare l'utente

Se hai disabilitato la registrazione pubblica:

1. Dashboard Supabase → **Authentication** → **Users** → **Add User**
2. Inserisci email e password
3. L'utente avra accesso alla PWA con queste credenziali

---

## 4. Deployment su Vercel (raccomandato)

Vercel e la piattaforma nativa per Next.js. Offre HTTPS automatico, CDN globale e zero configurazione server.

### 4.1 — Setup iniziale

```bash
# 1. Installa Vercel CLI (opzionale, puoi usare la dashboard)
npm i -g vercel

# 2. Collegati al progetto
vercel link

# 3. Deploy
vercel --prod
```

Oppure dalla dashboard:

1. [vercel.com](https://vercel.com) → **Import Git Repository**
2. Seleziona il repository
3. Framework preset: **Next.js** (rilevato automaticamente)
4. Clicca **Deploy**

### 4.2 — Variabili d'ambiente

Vai su **Project Settings → Environment Variables** e aggiungi:

| Variabile | Valore | Ambienti |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<replace-with-your-supabase-anon-key>` | Production, Preview |
| `ANTHROPIC_API_KEY` | `<replace-with-your-anthropic-api-key>` | Production |

> **Nota:** Le variabili `NEXT_PUBLIC_*` sono esposte nel bundle client — questo e corretto e necessario per Supabase. L'`ANTHROPIC_API_KEY` e `OPENAI_API_KEY` sono server-only: Next.js non le include nel client bundle perche NON hanno il prefisso `NEXT_PUBLIC_`.

### 4.3 — Dominio personalizzato

1. **Project Settings → Domains** → aggiungi il tuo dominio
2. Configura i record DNS come indicato da Vercel:
   - `A` record: `76.76.21.21`
   - oppure `CNAME`: `cname.vercel-dns.com`
3. HTTPS viene configurato automaticamente (Let's Encrypt)
4. Attiva **"Redirect to primary domain"** per evitare duplicazioni

### 4.4 — Impostazioni di sicurezza Vercel

| Impostazione | Dove | Raccomandazione |
|---|---|---|
| **Deployment Protection** | Settings → Deployment Protection | Attiva per le Preview, disattiva per Production |
| **Function Region** | Settings → Functions | Scegli `fra1` (Francoforte) per minimizzare latenza dall'Italia |
| **Build logs** | Sono privati di default | Verifica che non contengano API key nei log |

---

## 5. Deployment su VPS / self-hosted (alternativa)

Per chi preferisce il controllo totale (es. Hetzner, DigitalOcean, Oracle Cloud Free Tier).

### 5.1 — Setup server

```bash
# Su un server Ubuntu 22.04+

# 1. Installa Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clona il progetto
git clone https://github.com/TUO_UTENTE/selfos.git /opt/selfos
cd /opt/selfos

# 3. Installa dipendenze e builda
npm ci --production=false
npm run build

# 4. Crea il file .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
NODE_ENV=production
EOF

# 5. Proteggi il file .env.local
chmod 600 .env.local
```

### 5.2 — Process Manager (PM2)

```bash
# Installa PM2
sudo npm i -g pm2

# Avvia l'app
pm2 start npm --name "selfos" -- start

# Auto-restart al reboot
pm2 startup
pm2 save
```

### 5.3 — Reverse proxy con Nginx + HTTPS

```nginx
# /etc/nginx/sites-available/selfos

server {
    listen 80;
    server_name tuodominio.it;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tuodominio.it;

    # Certificati Let's Encrypt (generati con certbot)
    ssl_certificate     /etc/letsencrypt/live/tuodominio.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tuodominio.it/privkey.pem;

    # Sicurezza TLS
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Header di sicurezza aggiuntivi (oltre a quelli gia in next.config.ts)
    add_header X-Robots-Tag "noindex, nofollow" always;

    # Limiti request body (previene upload giganti)
    client_max_body_size 10M;

    # Rate limiting a livello Nginx (difesa perimetrale)
    limit_req_zone $binary_remote_addr zone=app:10m rate=30r/m;

    location / {
        limit_req zone=app burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Abilita il sito e genera certificato
sudo ln -s /etc/nginx/sites-available/selfos /etc/nginx/sites-enabled/
sudo certbot --nginx -d tuodominio.it
sudo nginx -t && sudo systemctl reload nginx
```

### 5.4 — Firewall

```bash
# Solo porte essenziali
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirect a HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 5.5 — Aggiornamenti automatici di sicurezza

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 6. Checklist di sicurezza per la produzione

### Gia implementato nell'app

| Protezione | Implementazione | File |
|---|---|---|
| **Content Security Policy** | Header completo senza `unsafe-eval`; `unsafe-inline` solo per stili | `next.config.ts` |
| **HSTS** | `max-age=63072000; includeSubDomains; preload` | `next.config.ts` |
| **X-Frame-Options** | `DENY` — impedisce embedding in iframe | `next.config.ts` |
| **X-Content-Type-Options** | `nosniff` — previene MIME sniffing | `next.config.ts` |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | `next.config.ts` |
| **Permissions-Policy** | Camera, microfono, geolocalizzazione disabilitati | `next.config.ts` |
| **RLS (Row Level Security)** | Ogni tabella ha policy `auth.uid() = user_id` | Migrazioni SQL |
| **XSS protection** | DOMPurify sulle pagine condivise, escaping su PDF export | `share/[token]/page.tsx`, `NoteEditor.tsx` |
| **Cookie security** | `httpOnly`, `secure`, `sameSite: lax` | `auth/login/route.ts` |
| **Auth middleware** | Redirect a `/login` per tutte le rotte protette | `middleware.ts` |
| **Rate limiting** | In-memory sliding window sulle API AI | `lib/rate-limit.ts` |
| **Input size validation** | Max 5 MB per upload immagini | `api/fitness/analyze/route.ts` |
| **Server-side auth check** | `supabase.auth.getUser()` su ogni API route | Tutte le API routes |

### Checklist da verificare prima del go-live

```
[ ] Variabili d'ambiente configurate correttamente
    - ANTHROPIC_API_KEY non ha il prefisso NEXT_PUBLIC_
    - SUPABASE_SERVICE_ROLE_KEY non e definita (a meno che non serva)

[ ] HTTPS attivo e forzato
    - Tutti gli URL usano https://
    - HTTP redirige a HTTPS (301)

[ ] Supabase
    - Registrazione pubblica disabilitata (se uso personale)
    - RLS attiva su TUTTE le tabelle
    - Nessuna policy con "true" come condizione (tranne shared_notes per lettura)
    - Database password forte (>= 20 caratteri)

[ ] DNS
    - Record CAA configurato per limitare le CA autorizzate
    - DNSSEC attivo se il registrar lo supporta

[ ] Backup
    - Backup automatico Supabase attivo (incluso nel piano)
    - Export JSON periodico tramite il pulsante in-app

[ ] Monitoring
    - Alerting su errori 5xx configurato
    - Log delle API non contengono dati sensibili

[ ] PWA
    - manifest.webmanifest servito correttamente
    - Service worker registrato (sw.js accessibile)
    - Icone presenti in /icons/
```

---

## 7. Dominio e HTTPS

### Perche e obbligatorio

- I **cookie `Secure`** funzionano solo su HTTPS
- Il **Service Worker** (PWA) richiede HTTPS (eccetto localhost)
- Le **API Supabase** comunicano via HTTPS — mixed content sarebbe bloccato
- **HSTS** (gia configurato) istruisce il browser a usare sempre HTTPS

### Opzioni dominio

| Opzione | Costo | Note |
|---|---|---|
| Dominio `.it` / `.com` | ~10-15 EUR/anno | Professionale, controllo DNS completo |
| Sottodominio Vercel (`*.vercel.app`) | Gratuito | HTTPS incluso, nessun DNS da gestire |
| Cloudflare Tunnel (VPS) | Gratuito | Alternativa a Nginx+Certbot, proxy integrato |

### Configurazione HSTS Preload (opzionale, massima sicurezza)

Se vuoi che il tuo dominio sia incluso nella HSTS preload list dei browser:

1. Verifica che HSTS sia servito con `includeSubDomains; preload` (gia configurato)
2. Vai su [hstspreload.org](https://hstspreload.org) e invia il dominio
3. **Attenzione:** una volta inserito nella preload list, non potrai piu servire HTTP — decisione permanente

---

## 8. Configurazione dei provider AI

L'app supporta **Anthropic** e **OpenAI** come provider AI. La configurazione e centralizzata in un unico file: non serve modificare codice applicativo.

### 8.1 — File di configurazione

```
config/ai.ts
```

Questo file definisce un oggetto con i "casi d'uso" AI dell'app:

| Caso d'uso | Funzione | Richiede Vision |
|---|---|---|
| `analyze` | Analisi screenshot fitness (estrae dati allenamento) | Si |
| `coach` | Generazione piani di allenamento settimanali | No |

### 8.2 — Configurazione attuale (Anthropic)

```typescript
export const aiConfig: Record<string, AIUseCaseConfig> = {
  analyze: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 1024,
    apiVersion: "2023-06-01",
  },
  coach: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 4096,
    apiVersion: "2023-06-01",
  },
};
```

### 8.3 — Come passare a OpenAI

**Step 1** — Aggiungi la chiave API OpenAI alle variabili d'ambiente:

```bash
# .env.local (sviluppo)
OPENAI_API_KEY=

# Su Vercel: Settings → Environment Variables → aggiungi OPENAI_API_KEY
```

**Step 2** — Modifica `config/ai.ts`:

```typescript
export const aiConfig: Record<string, AIUseCaseConfig> = {
  analyze: {
    provider: "openai",
    model: "gpt-4o",            // Supporta Vision
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com",
    maxTokens: 1024,
    // apiVersion non serve per OpenAI
  },
  coach: {
    provider: "openai",
    model: "gpt-4o-mini",       // Piu economico per testo
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com",
    maxTokens: 4096,
  },
};
```

**Step 3** — Aggiorna la CSP in `next.config.ts` (se non gia presente):

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com;
```

> Entrambi i domini sono gia presenti nella CSP attuale. Nessuna modifica necessaria.

**Step 4** — Redeploy:

```bash
# Vercel
vercel --prod

# VPS
npm run build && pm2 restart selfos
```

### 8.4 — Configurazione mista (provider diversi per caso d'uso)

Puoi usare provider diversi per ciascun caso d'uso. Esempio: OpenAI per Vision (analyze) e Anthropic per testo (coach):

```typescript
export const aiConfig: Record<string, AIUseCaseConfig> = {
  analyze: {
    provider: "openai",
    model: "gpt-4o",
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com",
    maxTokens: 1024,
  },
  coach: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 4096,
    apiVersion: "2023-06-01",
  },
};
```

In questo caso servono entrambe le chiavi API nelle variabili d'ambiente.

### 8.5 — Modelli consigliati

**Anthropic:**

| Modello | Caso d'uso | Vision | Costo relativo |
|---|---|---|---|
| `claude-sonnet-4-6` | Analyze (screenshot) | Si | Medio |
| `claude-haiku-4-5-20251001` | Coach (testo) | Si | Basso |
| `claude-opus-4-0-20250514` | Qualsiasi (massima qualita) | Si | Alto |

**OpenAI:**

| Modello | Caso d'uso | Vision | Costo relativo |
|---|---|---|---|
| `gpt-4o` | Analyze (screenshot) | Si | Medio |
| `gpt-4o-mini` | Coach (testo) | Si | Basso |
| `o3` | Qualsiasi (ragionamento avanzato) | Si | Alto |

### 8.6 — Parametri di configurazione

| Campo | Tipo | Descrizione |
|---|---|---|
| `provider` | `"anthropic" \| "openai"` | Provider API da utilizzare |
| `model` | `string` | Nome esatto del modello (come da documentazione del provider) |
| `apiKeyEnv` | `string` | Nome della variabile d'ambiente che contiene la API key |
| `baseUrl` | `string` | URL base dell'API. Modificabile per proxy, gateway o endpoint custom |
| `maxTokens` | `number` | Numero massimo di token nella risposta AI |
| `apiVersion` | `string?` | Versione API (solo Anthropic, formato `YYYY-MM-DD`) |

### 8.7 — Usare un proxy / API gateway

Se vuoi instradare le chiamate AI attraverso un proxy (es. per logging, caching o billing centralizzato), modifica solo il campo `baseUrl`:

```typescript
analyze: {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  baseUrl: "https://il-tuo-proxy.com/anthropic", // <-- cambia solo questo
  maxTokens: 1024,
  apiVersion: "2023-06-01",
},
```

Il client inviera le richieste a `https://il-tuo-proxy.com/anthropic/v1/messages` (Anthropic) o `.../v1/chat/completions` (OpenAI). Assicurati che il proxy preservi headers e body.

### 8.8 — Gestione crediti esauriti

L'app rileva automaticamente gli errori di crediti/quota esauriti e mostra un toast all'utente:

> "Crediti terminati: valuta i costi attuali e decidi quale utilizzare"

Pattern riconosciuti: `credit`, `insufficient_quota`, `rate_limit`, `billing`, `exceeded your current quota`, `overloaded`, `insufficient_funds`.

Per cambiare provider al volo quando i crediti finiscono, basta aggiornare `config/ai.ts` e fare redeploy.

## 9. Backup e disaster recovery

### 9.1 — Backup Supabase

- **Automatici:** inclusi nel piano Supabase (giornalieri, retention 7 giorni su free tier)
- **Manuali:** Dashboard → Database → Backups → Download

### 9.2 — Backup in-app

L'app include un pulsante **"Esporta JSON"** in Impostazioni che scarica tutti i dati dell'utente:

- Note e notebook
- Conti e bilanci finanziari
- Spese ricorrenti e impegni finanziari

Il file viene generato **interamente nel browser** (nessun dato transita per il server).

### 9.3 — Strategia consigliata

| Frequenza | Azione | Dove |
|---|---|---|
| Giornaliero | Backup automatico Supabase | Cloud Supabase |
| Settimanale | Export JSON manuale dall'app | Disco locale / cloud storage personale |
| Mensile | Snapshot completo del database | Supabase Dashboard → Download |

---

## 10. Monitoraggio

### Vercel (se usato)

- **Analytics:** attivabili nella dashboard del progetto
- **Logs:** Functions → seleziona la funzione → Real-time logs
- **Alerting:** Integrazioni con Slack, email, webhook per errori

### VPS

```bash
# Log dell'app
pm2 logs selfos

# Monitoraggio risorse
pm2 monit

# Log Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Supabase

- **Dashboard → Logs:** query SQL, auth events, API requests
- **Dashboard → Reports:** utilizzo storage, bandwidth, active users

---

## Riepilogo rapido

| Cosa devo fare | Come |
|---|---|
| **Hostare la PWA** | Vercel (consigliato): importa repo → configura env vars → deploy |
| **Proteggere i dati** | RLS gia attiva + middleware auth + security headers + HTTPS |
| **Cambiare provider AI** | Modifica solo `config/ai.ts` + aggiungi la chiave API + redeploy |
| **Cambiare modello AI** | Modifica il campo `model` in `config/ai.ts` + redeploy |
| **Aggiungere un dominio** | Vercel: Settings → Domains; VPS: Nginx + Certbot |
| **Backup dei dati** | Pulsante "Esporta JSON" in-app + backup automatici Supabase |
