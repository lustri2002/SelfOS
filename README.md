<p align="center">
  <img src="public/icons/icon.svg" width="96" height="96" alt="SelfOS logo" />
</p>

<h1 align="center">SelfOS</h1>

<p align="center">
  <strong>A self-hosted personal operating system for notes, tasks, finance, education, fitness, goals, and automations.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PWA-installable-5A67D8" alt="PWA" />
</p>

---

## Contents

- [Overview](#overview)
- [What I Built](#what-i-built)
- [Modules](#modules)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database and Migrations](#database-and-migrations)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Security and Privacy](#security-and-privacy)
- [Project Structure](#project-structure)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Repository Status](#repository-status)

---

## Overview

**SelfOS** is a full-stack Progressive Web App designed as a private, self-hosted command center. It brings together tools that usually live in separate apps: a second brain for notes and knowledge, a task manager, a finance dashboard, a fitness tracker with AI coaching, a configurable education record, goals, and a lightweight automation studio.

The app is built for personal use and self-hosting: Supabase authentication, user data isolated by Row Level Security, installable PWA support, light and dark themes, mobile layouts, and server-side API routes for sensitive integrations.

```text
SelfOS
|-- Home and Command Center
|-- Notes, notebooks, backlinks, sharing
|-- Tasks, projects, subtasks, Kanban, calendar
|-- Finance, budgets, net worth, ETFs, scenarios
|-- Fitness, Strava, training load, AI Coach
|-- Education, exams, credits, averages, projections
|-- Goal OS, automations, universal inbox
`-- PWA, export, notifications, security
```

## What I Built

SelfOS started as a personal system, but this repository is structured as a technical portfolio project:

- **Full-stack product work:** Next.js App Router, React Server Components, Route Handlers, Supabase Auth, PostgreSQL, RLS, and PWA behavior.
- **Privacy-first architecture:** user data is isolated by database policies, secrets stay server-side, and the service worker avoids caching personal API responses.
- **Domain depth:** Tiptap editor with backlinks, operational dashboards, personal finance tracking, fitness analytics, AI workflows, and OAuth/API integrations.
- **Modular self-hosting:** modules can be enabled or hidden through environment configuration without changing application code.

## Modules

All modules are enabled by default. A self-hosted instance can reduce the visible surface area with:

```bash
NEXT_PUBLIC_SELFOS_MODULES=notes,tasks,goals,finance,fitness,education,automation
# or
NEXT_PUBLIC_SELFOS_DISABLED_MODULES=education,finance
```

Supported modules are `notes`, `tasks`, `goals`, `finance`, `fitness`, `education`, and `automation`.

The main navigation, sidebar, Command Palette, Universal Inbox, Home, Settings, and Help screens respect this configuration.

## Demo Without Personal Data

This repository does not include real user data. To prepare a portfolio demo:

1. Create a dedicated Supabase user.
2. Add only synthetic notes, tasks, exams, workouts, and finance records.
3. Leave external integrations disconnected if you do not want to show them.
4. Review screenshots for names, emails, tokens, account balances, salary, or real investment data before publishing.

See [docs/DEMO.md](docs/DEMO.md).

---

## Features

### Home and Command Center

| Feature | Details |
|---|---|
| Aggregated dashboard | Recent notes, pinned notes, tasks, reminders, finance, fitness, and deadlines. |
| Operational briefing | Combines tasks, goals, money, education, fitness, and automations into one view. |
| Upcoming signals | Highlights overdue tasks, reminders, financial deadlines, exams, and off-track goals. |
| Operating modes | Computes a focus load and separates building, execution, and containment modes. |
| Fast navigation | Quick links to core modules and frequent actions. |

### Notes and Second Brain

| Feature | Details |
|---|---|
| Rich-text editor | Tiptap editor with headings, bold, italic, strike, code, quotes, lists, task lists, and tables. |
| Backlinks | Bidirectional links with `[[Note name]]` syntax and a dedicated backlink panel. |
| Hierarchical notebooks | Notebook organization with colors, emoji, and drag-and-drop note assignment. |
| Search | Title and content search with previews and highlighted matches. |
| Pins and colors | Pinned notes, color borders, emoji, and visual metadata for faster scanning. |
| Tags | Add and remove tags directly from the editor. |
| Templates | Create and reuse note templates. |
| Media | Image upload, drag and drop, clipboard paste, and fullscreen lightbox. |
| Outline | Heading panel for navigating long notes. |
| Versions | Version history and restore support. |
| Reminders | Note reminders, notification watcher, and dashboard alerts. |
| Pomodoro | 25/5 focus timer with browser notifications. |
| Export | Markdown export and browser print-to-PDF. |
| Public sharing | Revocable public links under `/share/[token]` with sanitized rendering. |
| Trash | Soft delete, restore, and permanent delete flows. |

### Tasks and Projects

| Feature | Details |
|---|---|
| Quick add | Fast task creation with priority. |
| Projects | Group tasks by project with color, emoji, and archive support. |
| Priority | Urgent, high, medium, and low priority sorting. |
| Statuses | `todo`, `in_progress`, and `done`. |
| Views | List, Kanban, calendar, and Today views. |
| Filters | Search, project, priority, tags, and completed task filters. |
| Subtasks | Nested checklist and progress tracking inside each task. |
| Recurrence | Daily, weekly, or monthly task recurrence. |
| Due dates | Today, tomorrow, and overdue highlighting. |
| Note links | Connect tasks to notes. |

### Personal Finance

| Feature | Details |
|---|---|
| Multi-type accounts | Checking, savings, investments, and other asset categories. |
| Balance snapshots | Monthly balance tracking by account. |
| Net worth | Assets, liquidity, residual debt, and net worth calculations. |
| Monthly income | Income by month, with support for separate budget months. |
| Budget cycle | Monthly saving and variable spending planning. |
| Recurring expenses | Monthly, quarterly, and yearly expenses normalized to monthly impact. |
| Commitments | Mortgages, loans, installments, debt, and financial goals. |
| Auto payments | Applies due installments for configured commitments. |
| ETF portfolio | Instruments, prices, transactions, positions, P&L, and account allocation. |
| Recurring investments | Automatic investment plans with due-plan application. |
| ETF prices | Twelve Data price sync, manual sync, and protected cron endpoint. |
| Analytics | Recharts visualizations for balances, income, expenses, net worth, and composition. |
| Scenarios | Financial trajectory planner and personal simulations. |
| Monthly notes | Contextual notes for financial months. |

### Fitness and AI Coach

| Feature | Details |
|---|---|
| Workouts | Manual log with distance, duration, pace, HR, cadence, elevation, steps, feeling, and notes. |
| Workout types | Easy run, tempo, intervals, long run, recovery, race, walk, cycling, and more. |
| AI Vision | Upload a fitness screenshot and extract structured workout data. |
| AI Review | Short coach feedback for a workout using recent history as context. |
| AI Coach | Weekly plan generation based on workout history and preferences. |
| Planned vs actual | Compare planned workouts with completed sessions. |
| Training load | TRIMP, CTL, ATL, TSB, monotony, strain, ACWR, form, and risk signals. |
| Strava | OAuth, connection status, activity sync, refresh tokens, and workout mapping. |
| Body metrics | Weight, height, body fat, resting HR, BMI, lean mass, fat mass, and trends. |
| Achievements | Badges for consistency, distance, body tracking, and screenshot imports. |
| Charts | Workout, body metric, and load trends. |

### Education

| Feature | Details |
|---|---|
| Configurable path | Program name, optional student name, total credits, final bonus, and honors value. |
| Exam record | Exams by year, credits, grade, honors, area, date, and ordering. |
| Exam states | To do, booked, completed online, and validated. |
| Exam types | Required or elective. |
| JSON import | Exam import with status and date normalization. |
| Filters | All, official, online, and missing exams. |
| Averages and credits | Weighted average, earned credits, and progress calculations. |
| Projections | Simulations with configurable honors value and target progress. |
| Guided transitions | Quick actions to book, mark online completion, and validate exams. |

### Goal Operating System

| Feature | Details |
|---|---|
| Measurable goals | Title, area, horizon, current value, target, unit, and due date. |
| Life areas | Health, money, study, work, relationships, and growth. |
| Horizons | Month, quarter, year, and vision. |
| Progress tracking | Progress percentage and average progress for active goals. |
| Risk signals | Overdue or off-track goals surfaced in Command Center. |
| Project links | Connect goals to operational projects. |
| Completed archive | Completed state and achieved evidence count. |

### Automation Studio

| Feature | Details |
|---|---|
| Personal rules | Readable "when/then" automation rules. |
| Triggers | Daily briefing, overdue tasks, goal risk, financial deadlines, skipped habits. |
| Actions | Surface in Command Center, create task, raise priority, suggest review. |
| Toggle | Enable or disable automations without deleting them. |
| Metrics | Rule count, active rules, and execution count. |

### Universal Inbox

| Feature | Details |
|---|---|
| Quick capture | Global keyboard-triggered overlay. |
| Smart parsing | Converts free-form text into a structured draft. |
| Destinations | Note, task, workout, finance income, or education milestone. |
| Manual override | Change destination before saving. |
| Post-save routing | Opens the right module after save. |

### PWA, UX, and System

| Feature | Details |
|---|---|
| Installable | PWA manifest with `/home` start URL, icons, and shortcuts. |
| Offline fallback | Service worker, `/offline` page, and network status banner. |
| Updates | New version detection and refresh toast. |
| Theme | Light and dark theme persisted in local storage. |
| Responsive layout | Desktop sidebar, mobile navigation, and iOS safe-area support. |
| Command Palette | `Cmd/Ctrl + K` for note search, note creation, and navigation. |
| Notifications | Browser notification settings and reminder watcher. |
| Data export | Full JSON export from Settings. |
| Profile | Display name editing and session management. |
| In-app Help | Internal documentation with shortcuts and module explanations. |

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19, Server Components, Route Handlers |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, CSS custom properties, lucide-react, Sonner |
| Editor | Tiptap 3 with custom note-link and image extensions |
| Charts | Recharts with dynamic imports |
| Database | Supabase PostgreSQL, Auth, RLS, SQL migrations |
| AI | Provider-agnostic client for Anthropic and OpenAI-compatible workflows |
| Integrations | Strava OAuth/API, Twelve Data |
| PWA | Manifest, custom service worker, offline page |
| Security | CSP, HSTS, cookie hardening, DOMPurify, rate limiting |

---

## Architecture

```text
Browser / PWA
     |
     | HTTPS
     v
Next.js App Router
|-- Server Components for protected pages
|-- Route Handlers for mutations and integrations
|-- Middleware and layout auth
|-- Service worker and manifest
     |
     +--> Supabase Auth + PostgreSQL + RLS
     +--> AI provider, optional
     +--> Strava API, optional
     `--> Twelve Data API, optional
```

The browser uses the Supabase anon key, while sensitive keys stay server-side in Route Handlers. Application queries are scoped by user, and Supabase tables are expected to enforce Row Level Security with policies based on `auth.uid()`.

### Architecture Highlights

- **Server-first data loading:** protected pages load data with Server Components and pass only UI-ready payloads to client components.
- **Clear API boundary:** mutations, OAuth, AI, and external sync run through server-side Route Handlers.
- **Module registry:** navigation, Inbox, Home, Command Palette, Settings, and Help read from shared module configuration.
- **Graceful degradation:** AI, Strava, and Twelve Data are optional; missing environment variables show unconfigured states instead of breaking core flows.
- **Self-hosted by design:** setup is explicit, secrets are local, and the user controls their data.

---

## Quick Start

### Prerequisites

- Node.js `>= 20`
- npm
- A Supabase project
- Optional Anthropic or OpenAI key for AI features
- Optional Strava and Twelve Data credentials for integrations

### Local Installation

```bash
git clone https://github.com/lustri2002/SelfOS.git
cd SelfOS
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to login when there is no active session.

### Minimal Supabase Setup

1. Create a project on [supabase.com](https://supabase.com).
2. Copy `Project URL` and `anon public key` into `.env.local`.
3. Run every SQL migration in `supabase/migrations/` in numerical order.
4. Configure Auth for your access model:
   - private instance: create users manually and disable public sign-up;
   - shared instance: keep controlled sign-up and review policies.
5. Start the app with `npm run dev`.

For a practical guide, see [SETUP.md](SETUP.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
For portfolio-safe demo data, see [docs/DEMO.md](docs/DEMO.md).

---

## Environment Variables

Minimum required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Recommended and optional values:

| Variable | Required | Usage |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key, protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side admin access only for features that require it. |
| `APP_ORIGIN` | No | Public origin for absolute links, falling back to request origin. |
| `NEXT_PUBLIC_APP_ORIGIN` | No | Public client-side origin when needed. |
| `NEXT_PUBLIC_SELFOS_MODULES` | No | Public comma-separated allowlist of active modules. |
| `NEXT_PUBLIC_SELFOS_DISABLED_MODULES` | No | Public comma-separated list of modules to hide. |
| `APP_ENC_KEY` | No | Base64 32-byte key for encrypting server-side application secrets. |
| `ANTHROPIC_API_KEY` | No | AI Vision, AI Coach, and AI Review when the default config uses Anthropic. |
| `OPENAI_API_KEY` | No | Alternative provider key if `config/ai.ts` is configured for OpenAI. |
| `STRAVA_CLIENT_ID` | No | Strava OAuth. |
| `STRAVA_CLIENT_SECRET` | No | Server-side Strava OAuth secret. |
| `STRAVA_REDIRECT_URI` | No | Strava callback URL. |
| `TWELVE_DATA_API_KEY` | No | ETF price updates. |
| `FINANCE_CRON_SECRET` | No | Secret for protected investment cron endpoint. |

AI configuration is centralized in [config/ai.ts](config/ai.ts). Changing provider or model requires editing that file and setting the matching provider key.

---

## Database and Migrations

Migrations live in [supabase/migrations](supabase/migrations) and cover:

- initial schema for notes, notebooks, accounts, snapshots, recurring expenses, commitments, and fitness;
- pinned notes, public sharing, versions, trash, and templates;
- reminders, colors, nested notebooks, and task management;
- shared projects, monthly income, and finance notes;
- fitness habits, training plans, planned workouts, and body metrics;
- Strava, extended workout metrics, AI feedback, and data constraints;
- education settings, exams, statuses, and deduplication;
- Goal OS and automations;
- monthly budgets and ETF portfolio tracking.

Run files in numerical order. Supabase CLI can be used for repeatable deployments; for a personal instance, the Supabase SQL Editor is also sufficient.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js in development mode. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production build. |
| `npm run lint` | Run ESLint. |
| `npm run deploy` | Run the Bash deployment script in `scripts/deploy.sh`. |

---

## Deployment

### Vercel

1. Import the repository into Vercel.
2. Set environment variables.
3. Run Supabase migrations.
4. Configure optional callbacks:
   - Strava: `/api/fitness/strava/callback`
   - Supabase Auth: `/auth/callback`
5. Deploy.

For Vercel Cron or an external scheduler:

```text
POST /api/finance/investments/cron
Authorization: Bearer <FINANCE_CRON_SECRET>
```

### VPS / Self-hosted

```bash
npm install
npm run build
npm run start
```

In production, use HTTPS, a reverse proxy, server-side environment variables, and database backups. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Security and Privacy

SelfOS handles sensitive personal data. Main protections:

| Layer | Protection |
|---|---|
| Auth | Supabase Auth, protected routes, secure session cookies. |
| Database | Row Level Security on user-owned tables. |
| API | User checks, field allowlists, rate limits on AI and sync endpoints. |
| Browser | CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. |
| XSS | DOMPurify and escaping on shared pages and exports. |
| PWA | API and personal data excluded from service worker cache. |
| Secrets | AI, Strava, Twelve Data, and service role keys stay server-side. |

Before publishing an instance or repository:

- never commit `.env.local` or real keys;
- rotate secrets that were ever exposed;
- choose the license intentionally;
- confirm Supabase sign-up matches the intended access model;
- review OAuth callbacks and allowed origins.

---

## Project Structure

```text
selfos/
|-- app/
|   |-- (auth)/                 # Login and auth layout
|   |-- (protected)/            # Protected pages
|   |   |-- home/               # Personal dashboard
|   |   |-- command/            # Command Center
|   |   |-- notes/              # Notes and editor
|   |   |-- tasks/              # Task manager
|   |   |-- finance/            # Finance dashboard
|   |   |-- fitness/            # Fitness tracker
|   |   |-- university/         # Education record
|   |   |-- goals/              # Goal OS
|   |   |-- automation/         # Automation Studio
|   |   |-- trash/              # Notes trash
|   |   |-- settings/           # Profile, export, notifications
|   |   `-- help/               # In-app help
|   |-- api/                    # Route Handlers
|   |-- auth/                   # Login, logout, callback
|   |-- share/[token]/          # Public shared notes
|   `-- offline/                # PWA fallback
|-- components/
|   |-- ui/                     # Shared UI components
|   |-- notes/                  # Editor, list, reminders, Pomodoro
|   |-- tasks/                  # TaskManager
|   |-- finance/                # FinanceDashboard
|   |-- fitness/                # FitnessTracker
|   |-- university/             # UniversityDashboard
|   |-- goals/                  # GoalsOperatingSystem
|   |-- automation/             # AutomationStudio
|   |-- command/                # CommandCenter
|   |-- inbox/                  # UniversalInbox
|   `-- notifications/          # Browser notifications
|-- lib/
|   |-- supabase/               # Server, browser, and admin clients
|   |-- ai/                     # Provider-agnostic AI client
|   |-- finance/                # Formatters and investment logic
|   |-- fitness/                # Fitness formatters
|   |-- tiptap/                 # Custom editor extensions
|   |-- inbox/                  # Universal inbox parser
|   |-- strava.ts               # Strava client
|   |-- training-load.ts        # Training load metrics
|   `-- crypto.ts               # Secret encryption
|-- config/ai.ts                # AI providers and models
|-- config/modules.ts           # Module registry and flags
|-- supabase/migrations/        # SQL migrations
|-- types/database.ts           # Supabase types
|-- public/                     # Manifest, service worker, icons
|-- docs/DEPLOYMENT.md          # Production deployment guide
`-- SETUP.md                    # Quick setup guide
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open Command Palette. |
| `Cmd/Ctrl + Shift + I` | Open Universal Inbox. |
| `Cmd/Ctrl + S` | Save note. |
| `Cmd/Ctrl + B` | Bold in editor. |
| `Cmd/Ctrl + I` | Italic in editor. |
| `Cmd/Ctrl + E` | Inline code in editor. |
| `Cmd/Ctrl + Shift + S` | Strike in editor. |
| `Esc` | Close palette, lightbox, and contextual menus. |

---

## Repository Status

SelfOS is published as a portfolio-friendly self-hosted project. It is useful as a reference implementation for:

- modular personal productivity systems;
- Supabase RLS-backed personal data apps;
- installable PWA behavior in a Next.js App Router project;
- server-side integration boundaries for AI, OAuth, and external APIs.

Possible next improvements:

- add public screenshots or a short demo GIF;
- add lightweight smoke tests for protected routes;
- add contribution guidelines if external contributions become a goal;
- add a hosted demo with synthetic data only.

---

<p align="center">
  <sub>Built with Next.js, Supabase, Tiptap, Tailwind CSS, and AI provider integrations.</sub>
</p>
