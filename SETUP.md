# SelfOS Setup Guide

This guide covers the fastest path to running SelfOS locally with a Supabase project.

## 1. Supabase

1. Create a project on [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run every file in `supabase/migrations/` in numerical order.
3. Confirm that Row Level Security policies are enabled on user-owned tables.
4. Open **Authentication -> Users** and create your account manually, or enable controlled sign-up for a demo instance.
5. Open **Settings -> API** and copy:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Environment Variables

```bash
cp .env.example .env.local
# Open .env.local and paste your Supabase values
```

To hide modules that are not relevant for your installation:

```bash
# Leave empty to enable every module
NEXT_PUBLIC_SELFOS_DISABLED_MODULES=education,finance

# Or use an allowlist
NEXT_PUBLIC_SELFOS_MODULES=notes,tasks,goals,fitness
```

## 3. PWA Icons

The repository includes default PWA icons in `public/icons/`.

To replace them, provide:

- `icon-192.png` (192x192 px)
- `icon-512.png` (512x512 px)

You can generate maskable icons from any source image with [maskable.app](https://maskable.app).

## 4. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to login when there is no active session.

## 5. Vercel Deployment

```bash
npm i -g vercel
vercel
```

Add these environment variables in the Vercel dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- optional `NEXT_PUBLIC_SELFOS_MODULES` or `NEXT_PUBLIC_SELFOS_DISABLED_MODULES`

## 6. Install as an iPhone PWA

1. Open Safari and visit your deployed URL.
2. Tap **Share** -> **Add to Home Screen**.
3. SelfOS will appear as an installed app.

## Security Notes

- Protected routes require an active Supabase session.
- User-owned tables are protected by Row Level Security.
- If you use magic links with `shouldCreateUser: false`, only users already created in Supabase can sign in.
- Supabase encrypts data at rest by default.
- The service worker never caches API responses or personal data.

## Portfolio Demo

- Use a dedicated Supabase user for demo content.
- Add only synthetic notes, tasks, education records, workouts, and finance data.
- Leave optional integrations disconnected unless you want to show them: Strava, Twelve Data, and AI providers.
- Before capturing screenshots, check Settings, sidebar state, and visible data for names, emails, tokens, balances, or real account details.
