# meandu

A calendar-first app for couples: plan together, count down to the good stuff, keep your memories.

Web and installable PWA first, native apps (iOS, Android, desktop) via Tauri v2 later. Lives at [couple.bojes.org](https://couple.bojes.org).

**Status:** Phase 1 built. Accounts start on the phone and can be kept safe with a passkey or an email code; pairing with a code or link; syncing between two phones (offline too), with photos shared as small previews; unlinking, relinking and deleting a space or an account. The demo is one tap away on the welcome screen. See [docs/PLAN.md](docs/PLAN.md) for the product and technical plan.

## Develop

Needs Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev:api     # API on http://localhost:8787, on an embedded Postgres kept in apps/web/.pglite
pnpm dev         # app on http://localhost:5173, sends /api to the API (also reachable from your phone on the same Wi-Fi)
pnpm check       # lint + format check (Biome)
pnpm format      # fix formatting
pnpm typecheck
pnpm test
pnpm build       # production build in apps/web/dist (runs migrations first when a database is configured)
```

Deploys: Vercel builds every push. The API runs as one function in Frankfurt and reads its database from `POSTGRES_URL` (set by the Neon integration). Other settings:

- `BETTER_AUTH_SECRET` signs sessions. Don't rotate it: device-only accounts would be signed out for good.
- `RESEND_API_KEY` turns on email sign-in (the Resend integration from the Vercel Marketplace sets it); `EMAIL_FROM` overrides the sender (`meandu <hallo@couple.bojes.org>`).
- `CRON_SECRET` lets Vercel run the daily job that deletes photo previews no memory uses anymore.

## Layout

```
apps/web         the app (React + Vite, installable PWA) and its API (Hono, Drizzle, Better Auth)
packages/core    calendar logic and sync protocol shared by app and server: dates, recurring events, countdowns
docs/PLAN.md     the plan
```
