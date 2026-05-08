# SelfOS Deployment Guide

This guide explains how to deploy SelfOS as a private, self-hosted Progressive Web App.

## Contents

1. [Deployment Architecture](#1-deployment-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Supabase Configuration](#3-supabase-configuration)
4. [Vercel Deployment](#4-vercel-deployment)
5. [VPS Deployment](#5-vps-deployment)
6. [Production Security Checklist](#6-production-security-checklist)
7. [Domain and HTTPS](#7-domain-and-https)
8. [AI Provider Configuration](#8-ai-provider-configuration)
9. [Backups and Recovery](#9-backups-and-recovery)
10. [Monitoring](#10-monitoring)

## 1. Deployment Architecture

```text
Browser / PWA
     |
     | HTTPS
     v
Next.js App
|-- Server Components
|-- Route Handlers
|-- Auth middleware
|-- Service worker
     |
     +--> Supabase Auth + PostgreSQL + RLS
     +--> AI provider, optional
     +--> Strava API, optional
     `--> Twelve Data API, optional
```

| Component | Role | Sensitive Data |
|---|---|---|
| Next.js app | SSR, API routes, auth middleware | API keys, session cookies |
| Supabase | PostgreSQL, Auth, Row Level Security | User data |
| AI provider | Screenshot analysis and fitness coaching | Images or text sent for analysis |
| Strava | Fitness activity sync | OAuth tokens |
| Twelve Data | ETF price updates | API key |

## 2. Prerequisites

- Node.js 20 or newer
- npm
- Supabase account
- Vercel account, or a VPS with Node.js
- Optional custom domain
- Optional AI provider key for Anthropic or OpenAI
- Optional Strava and Twelve Data credentials

## 3. Supabase Configuration

### 3.1 Create the Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose the region closest to your users.
3. Set a strong database password.
4. Copy:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.2 Run Migrations

Run every SQL file in `supabase/migrations/` in numerical order.

For a small personal instance, the Supabase SQL Editor is enough. For repeatable deployments, adapt the workflow to the Supabase CLI and run `supabase db push`.

### 3.3 Database Security

Row Level Security is expected to be enabled on user-owned tables. Policies should scope records with `auth.uid() = user_id`, so authenticated users can access only their own data.

Recommended Supabase settings:

| Setting | Location | Recommendation |
|---|---|---|
| Public sign-up | Authentication -> Settings | Disable for a private instance |
| Email confirmation | Authentication -> Settings | Enable if sign-up is open |
| JWT expiry | Authentication -> Settings | Keep default or reduce for stricter sessions |
| Service role key | Settings -> API | Never expose it to the browser |

### 3.4 Create the First User

If public sign-up is disabled:

1. Open **Authentication -> Users -> Add User**.
2. Create the user manually.
3. Sign in from the app with those credentials or with the configured magic-link flow.

## 4. Vercel Deployment

Vercel is the recommended hosting path for most Next.js deployments.

### 4.1 Deploy from GitHub

1. Open [vercel.com](https://vercel.com).
2. Import the SelfOS repository.
3. Keep the detected framework preset as **Next.js**.
4. Add the required environment variables.
5. Deploy.

CLI alternative:

```bash
npm i -g vercel
vercel link
vercel --prod
```

### 4.2 Environment Variables

Add these in **Project Settings -> Environment Variables**:

| Variable | Required | Notes |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key protected by RLS |
| `APP_ORIGIN` | No | Canonical production origin |
| `NEXT_PUBLIC_APP_ORIGIN` | No | Public origin for client-side use |
| `APP_ENC_KEY` | No | Base64 32-byte key for server-side token encryption |
| `ANTHROPIC_API_KEY` | No | Required only for Anthropic-backed AI features |
| `OPENAI_API_KEY` | No | Required only if `config/ai.ts` uses OpenAI |
| `STRAVA_CLIENT_ID` | No | Required only for Strava OAuth |
| `STRAVA_CLIENT_SECRET` | No | Server-side Strava secret |
| `STRAVA_REDIRECT_URI` | No | Example: `https://example.com/api/fitness/strava/callback` |
| `TWELVE_DATA_API_KEY` | No | Required only for ETF price sync |
| `FINANCE_CRON_SECRET` | No | Required only for protected finance cron endpoints |
| `NEXT_PUBLIC_SELFOS_MODULES` | No | Public allowlist of enabled modules |
| `NEXT_PUBLIC_SELFOS_DISABLED_MODULES` | No | Public list of hidden modules |

`NEXT_PUBLIC_*` values are bundled for the browser by design. Keep provider keys, cron secrets, service role keys, and encryption keys server-side only.

### 4.3 Callback URLs

Configure callback URLs for any providers you enable:

- Supabase Auth: `/auth/callback`
- Strava: `/api/fitness/strava/callback`

Use absolute production URLs in provider dashboards.

## 5. VPS Deployment

Use a VPS when you want full operational control.

### 5.1 Server Setup

```bash
# Ubuntu 22.04+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

git clone https://github.com/lustri2002/SelfOS.git /opt/selfos
cd /opt/selfos

npm ci
npm run build
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_ORIGIN=https://selfos.example.com
NODE_ENV=production
```

Then protect it:

```bash
chmod 600 .env.local
```

### 5.2 Process Manager

```bash
sudo npm i -g pm2
pm2 start npm --name selfos -- start
pm2 startup
pm2 save
```

### 5.3 Reverse Proxy

Use Nginx, Caddy, Traefik, or a managed reverse proxy. At minimum, enforce HTTPS and forward requests to the Next.js process on port `3000`.

Example Nginx outline:

```nginx
server {
    listen 80;
    server_name selfos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name selfos.example.com;

    ssl_certificate     /etc/letsencrypt/live/selfos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/selfos.example.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.4 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 6. Production Security Checklist

Implemented or expected in the app:

| Control | Implementation |
|---|---|
| Content Security Policy | Configured in `next.config.ts` |
| HSTS | Configured in `next.config.ts` |
| Frame protection | `X-Frame-Options: DENY` |
| Referrer policy | `strict-origin-when-cross-origin` |
| Permissions policy | Camera, microphone, and geolocation disabled by default |
| Database isolation | Supabase Row Level Security |
| XSS protection | Sanitized shared pages and export rendering |
| Auth boundary | Middleware and server-side user checks |
| Rate limiting | In-memory limiter for AI and sync endpoints |
| PWA cache safety | API responses and personal data excluded from service worker cache |

Before production:

```text
[ ] Environment variables are configured for the right environment.
[ ] No secret uses the NEXT_PUBLIC_ prefix.
[ ] HTTPS is enabled and HTTP redirects to HTTPS.
[ ] Supabase public sign-up matches your access model.
[ ] RLS is enabled on all user-owned tables.
[ ] OAuth callback URLs match the production origin.
[ ] Logs do not include tokens, financial data, or private notes.
[ ] Backups are configured and periodically tested.
[ ] Optional modules without providers show an unconfigured state, not runtime errors.
```

## 7. Domain and HTTPS

HTTPS is required for secure cookies, OAuth callbacks, and installable PWA behavior outside localhost.

Options:

| Option | Notes |
|---|---|
| Custom domain on Vercel | Recommended for the easiest setup |
| Vercel subdomain | Good for demos and private testing |
| VPS with Let's Encrypt | Good when you need full control |
| Cloudflare Tunnel | Useful when avoiding direct inbound traffic to a VPS |

If you enable HSTS preload, treat it as a long-term commitment: browsers will force HTTPS for the domain and subdomains.

## 8. AI Provider Configuration

SelfOS supports Anthropic and OpenAI through a small provider abstraction in `config/ai.ts`.

The configuration maps AI use cases to provider, model, base URL, and API key environment variable:

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

To switch a use case to OpenAI, change `provider`, `model`, `apiKeyEnv`, and `baseUrl`, then set `OPENAI_API_KEY` in the deployment environment.

AI features should degrade gracefully when provider keys are missing. Keep provider keys server-side and never expose them with a `NEXT_PUBLIC_` prefix.

## 9. Backups and Recovery

Recommended backup strategy:

| Frequency | Action | Location |
|---|---|---|
| Daily | Supabase automatic backup, if available on your plan | Supabase |
| Weekly | Manual in-app JSON export | Local or private cloud storage |
| Monthly | Full database snapshot | Supabase dashboard or CLI |

The in-app export is intended for personal recovery and portability. Treat exported files as sensitive.

## 10. Monitoring

For Vercel:

- Use Function logs for API and server-side failures.
- Add alerts for repeated 5xx errors.
- Review build logs after dependency upgrades.

For VPS:

```bash
pm2 logs selfos
pm2 monit
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

For Supabase:

- Review Auth logs for failed sign-ins.
- Review API and database logs for policy errors.
- Monitor storage, bandwidth, and database usage.

## Quick Reference

| Goal | Recommended Path |
|---|---|
| Host the PWA | Vercel import -> env vars -> deploy |
| Protect user data | RLS, middleware auth, HTTPS, server-only secrets |
| Change AI provider | Edit `config/ai.ts`, add provider key, redeploy |
| Add a custom domain | Vercel Domains or VPS reverse proxy |
| Back up data | In-app JSON export plus Supabase backups |
