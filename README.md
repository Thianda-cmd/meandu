# meandu

A calendar-first app for couples: plan together, count down to the good stuff, keep your memories.

Web and installable PWA first, native apps (iOS, Android, desktop) via Tauri v2 later. Lives at [couple.bojes.org](https://couple.bojes.org).

**Status:** Phase 0, a clickable prototype with demo data that stays on your device. See [docs/PLAN.md](docs/PLAN.md) for the product and technical plan.

## Develop

Needs Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev         # app on http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
pnpm check       # lint + format check (Biome)
pnpm format      # fix formatting
pnpm typecheck
pnpm test
pnpm build       # production build in apps/web/dist
```

## Layout

```
apps/web         the app (React + Vite, installable PWA)
packages/core    calendar logic shared by app and server: dates, recurring events, countdowns
docs/PLAN.md     the plan
```
