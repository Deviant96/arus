# Arus — Personal Spending Tracker

A transaction-first personal finance app. Recording an expense should feel like this:

```
Open app  →  tap +  →  amount  →  category  →  payment method  →  Save
```

Installments, recurring rules, budgets, reports and optional AI analysis stay available without getting in the way of that loop.

Dark theme by default. Works offline. Deploys as a single Nuxt app + PostgreSQL.

---

## Stack

- **Nuxt 4** + Vue 3 + TypeScript
- **Nuxt UI** + Tailwind CSS
- **PostgreSQL** via **Drizzle ORM** (PGlite for zero-setup local development)
- **Zod** shared between client forms and server routes
- **IndexedDB** + service worker for offline
- **ECharts** for reports

## Local development

Requires Node 22+.

```bash
npm install
cp .env.example .env
# edit NUXT_SESSION_PASSWORD and NUXT_AI_ENCRYPTION_KEY (any 32+ char strings)

npm run db:migrate   # applied automatically on first boot too
npm run db:seed      # demo account: demo@arus.app / demo1234
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local development uses **PGlite** (embedded Postgres) under `.data/pglite`. No Docker or system Postgres required.

```bash
npm run db:reset     # wipe + remigrate
npm run db:seed      # reseed demo data
npm test             # unit + integration tests
```

## Docker (production / VPS)

```bash
cp .env.example .env
# set NUXT_SESSION_PASSWORD, NUXT_AI_ENCRYPTION_KEY
# set NUXT_PUBLIC_APP_URL to the URL you will open (must match APP_PORT)

docker compose up -d --build
```

This starts PostgreSQL 16 and the Nuxt app on host port **3100** (mapped to the container's 3000). Migrations run on boot. Inter is bundled in the image, so the build does not download fonts from the internet.

On a small VPS, `npm run build` used to sit on `Building Nuxt Nitro server` for hours (file-tracing every `node_modules` file, often while swapping). Docker builds now skip that trace and copy production `node_modules` into the image instead. If an old build is still stuck there, stop it — waiting will not finish it.

If 3100 is taken too, set `APP_PORT` in `.env` and point `NUXT_PUBLIC_APP_URL` at the same port:

```
APP_PORT=8088
NUXT_PUBLIC_APP_URL=http://localhost:8088
```

To seed the demo account against Docker Postgres:

```bash
NUXT_DATABASE_URL=postgres://arus:arus@localhost:5432/arus npm run db:seed
```

## Google sign-in

Create an OAuth client (Web application) and set:

```
NUXT_OAUTH_GOOGLE_CLIENT_ID=...
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=...
NUXT_PUBLIC_APP_URL=https://your-domain
```

Authorized redirect URI: `https://your-domain/api/auth/google`.

Leave the Google variables blank to hide the button — email/password still works.

## AI analysis (optional)

Arus never requires AI. Each user can bring their own OpenAI or Gemini key in **Settings → AI**. Keys are encrypted with AES-256-GCM (`NUXT_AI_ENCRYPTION_KEY`) and never returned to the browser.

The backend sends a compact, pre-aggregated snapshot (totals, category breakdown, budgets, installment obligations) — never the raw transaction table.

## Core product rules

- Amounts are stored as integer minor units. IDR has 0 decimals.
- Transfers are not expenses and never appear in spending totals.
- Installments keep a **schedule of expected occurrences** plus a separate **payment history**. Future installments are not pre-created as transactions.
- Recurring rules work the same way: expected vs confirmed.
- Editing an installment schedule never rewrites paid history.
- Every query is scoped by `user_id`.

## Project layout

```
shared/          Zod schemas, money/date utils, API DTO types
server/
  database/      Drizzle schema, migrations, seed
  services/      Domain logic (transactions, installments, reports, …)
  api/           Nuxt server routes
app/
  pages/         Routes
  components/    UI
  composables/   Client services, offline API wrapper
  stores/        Sync queue (Pinia)
tests/           Vitest — calculations + PGlite integration
```
