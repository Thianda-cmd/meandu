# meandu: product & technical plan

> Working title **meandu** ("me & u"). A calendar-first app for couples: plan together, count down to the good stuff, keep your memories.
> Web + installable PWA first, native apps (iOS, Android, desktop) via Tauri v2 later.
>
> Owner: Mikolaj Boje · Lives at: couple.bojes.org
> Status: Phase 0 (clickable prototype) · Last updated: 2026-10-22

1. [Decisions so far](#1-decisions-so-far)
2. [Product scope](#2-product-scope)
3. [Screens & navigation](#3-screens--navigation)
4. [Design direction](#4-design-direction-soft--warm)
5. [Architecture](#5-architecture)
6. [Data model](#6-data-model-v1-sketch)
7. [Sync](#7-sync)
8. [Accounts & pairing](#8-accounts--pairing)
9. [Notifications & reminders](#9-notifications--reminders)
10. [Photos](#10-photos-memories)
11. [Native feel](#11-native-feel-the-building-blocks)
12. [Privacy, security & GDPR](#12-privacy-security--gdpr)
13. [Quality, CI & environments](#13-quality-ci--environments)
14. [Running costs](#14-running-costs-rough)
15. [Roadmap](#15-roadmap)
16. [Risks to test early](#16-risks-to-test-early)
17. [Open questions](#17-open-questions)
18. [References](#18-references)

---

## 1. Decisions so far

| Topic | Decision | Why |
|---|---|---|
| Audience | Public app for couples (exactly two people per space) | |
| Platforms | Web + PWA first, Tauri v2 for iOS / Android / desktop later | One codebase for every platform |
| Frontend | React 19 + TypeScript + Vite, built as a static single-page app | Biggest ecosystem for native-feel pieces; a static build is exactly what Tauri wraps |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, Cron, Edge Functions | Covers everything this app needs, open source, plain SQL |
| Data region | EU (Frankfurt) | Simplest GDPR story for intimate data; the app reads from its local copy, so distance barely matters |
| v1 features | Shared calendar, countdowns & special days, shared lists, memories | |
| Later | "When are we both free?" + external calendar import | Fits the native phase, where the app can read the phone's calendars |
| Design | Own brand look everywhere, "Soft & warm", light + dark | |
| Voice | Very little text, warm and human; icons and visuals do most of the talking | It should feel like a note from a friend, not software |
| Languages | English and German from day one | |
| Domain | couple.bojes.org | |
| Minimum age | 14 | See the note in [§12](#12-privacy-security--gdpr) |
| Unlinking | The space pauses instead of disappearing; relinking restores it; it is deleted when either partner asks | Reversible if it wasn't really over, and still lawful (details in [§8](#8-accounts--pairing)) |
| Business | Free at launch; a plan per space is stored from day one so premium can be switched on later | |

## 2. Product scope

### v1 (public web launch)

**Shared calendar (the core)**
- Agenda, month, week (and 3-day) and day views
- Every event is for me, for my partner, or for both of us, and is colour-coded accordingly
- Shared by default; "private" hides an event from the partner entirely
- All-day and timed events, time zones, recurring events (edit "just this one" / "this and following" / "all")
- Reminders per person; a push notification when your partner adds or changes plans (batched, with quiet hours)

**Countdowns & special days**
- Anniversaries, birthdays and custom yearly days; "together since" powers a days-together counter
- Any event can be pinned as a countdown ("Paris in 12 days")
- Milestones (100 / 1,000 days, anniversaries) get a little celebration

**Shared lists**
- To-dos, groceries, date-night ideas, bucket list (one model, different list types)
- Instant check-off sync that also works offline (supermarket basements)
- Swipe to complete or delete, drag to reorder, assign to me or my partner

**Memories**
- A timeline of moments with photos, a date, and an optional place and note
- Link a memory to a past event (gentle "add memories?" prompt after a date night)

**Accounts & space**
- Sign in with a 6-digit email code; Apple / Google where they work reliably (see [§8](#8-accounts--pairing))
- Invite your partner via link, QR code or short code; the app is fully usable solo until they join
- Profile: name, photo, colour, time zone
- Settings: notifications, appearance, export my data, delete my account, unlink

### Later
- "When are we both free?" + external calendars (device calendars in the native apps, Google, ICS subscriptions)
- A private `.ics` feed so the shared calendar also shows up in Apple / Google Calendar
- "Busy only" events (partner sees a busy block without details); the data model leaves room for it
- Home-screen widgets, share-into-app ("add this link to date ideas"), natural-language quick add
- Premium tier

### Not planned
- Chat (couples already have WhatsApp / iMessage), groups or families, expense splitting

## 3. Screens & navigation

Bottom tab bar on phones, sidebar on tablets and desktop:

| Tab | What's there |
|---|---|
| **Today** | Greeting, days together, next up (today / tomorrow), nearest countdown, list peek, partner's day at a glance |
| **Calendar** | Month (infinite scroll), week / 3-day / day, agenda; filter me / partner / us |
| **Lists** | All lists, then list detail |
| **Memories** | Timeline grid, then memory detail |

- A **+** button opens a create sheet (event, countdown, list item, memory) that adapts to the current tab.
- Settings live behind the avatar on Today.
- Creating and editing happen in **bottom sheets**; viewing details is a **pushed screen** with swipe-back.
- Outside the tabs: onboarding, sign-in, pairing, and the iPhone install guide.

## 4. Design direction: "Soft & warm"

Cozy and romantic, never cheesy. Think Headspace × Paired.

| Token | Value |
|---|---|
| Background | cream `#FFF7F2` (dark mode: plum-black `#1C1418`) |
| Partner colour 1 (default) | coral `#FF7A6B` |
| Partner colour 2 (default) | sage `#6FB3A0` |
| Together | lilac `#A98BFF` |

- Each partner picks their own colour; "together" stays lilac. Every colour gets tints and shades so text always meets WCAG AA contrast (coral itself is too light for white text). Colours are tuned separately for dark mode.
- **Type:** a rounded face for titles (`ui-rounded`, which is SF Pro Rounded on Apple devices, with self-hosted Nunito elsewhere) and the system font for body text. Follows the iOS text-size setting.
- **Shapes:** large radii (~24px on cards and sheets), soft layered shadows, no hard borders.
- **Motion:** bouncy but quick springs, a tiny heart pop on save, a light celebration for milestones. Everything respects "reduce motion".
- **Icons:** Phosphor (rounded, with fill and duotone weights).
- The design system lives in code (tokens + components) and gets reviewed on real phones in the Phase 0 prototype rather than in static mockups.

## 5. Architecture

### Principles
1. **Static SPA + platform layer.** The app is plain static files talking to Supabase. Device features go through `platform/` (web now, Tauri later), so every platform runs the same build.
2. **Local-first.** Screens read from a database on the device; writes apply instantly and sync in the background. Everything keeps working offline.
3. **Privacy by design.** EU hosting, authorization enforced inside the database, realtime messages that carry no content, no third-party trackers or font CDNs.
4. **Calendar logic is pure and tested.** Recurrence, time zones and countdowns live in `packages/core`, shared by the app and the server functions.
5. **Native feel is a feature.** It has its own building blocks ([§11](#11-native-feel-the-building-blocks)), a performance budget and real-device testing.

### Stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict) everywhere |
| UI | React 19 (its `<Activity>` component keeps tabs alive in the background), Vite |
| Navigation | Our own tab / stack navigator with URL sync (native back behaviour doesn't map onto URL routers, so we skipped TanStack Router) |
| Interaction | React Aria Components (accessible, touch-correct primitives), Motion (springs and gestures) |
| Styling | Tailwind CSS v4, design tokens as CSS variables |
| Local database | Dexie (IndexedDB) with live queries |
| Sync | A small sync layer of our own over Supabase ([§7](#7-sync)) |
| Dates | Temporal API (polyfilled where missing), RFC 5545 recurrence rules |
| Validation | Zod, shared by the app and server functions |
| Languages | Small typed dictionaries for English and German (the compiler catches missing German strings), `Intl` for dates and numbers |
| Pickers | The phone's own date, time and option wheels, shown as formatted pills |
| Long lists | TanStack Virtual (month view, agenda, memories) |
| PWA | vite-plugin-pwa (Workbox) for the offline app shell and updates, plus our own service-worker code for Web Push |
| Backend | Supabase in the EU: Postgres, Auth, Realtime, Storage, Cron, Edge Functions (Deno) |
| Hosting | Vercel for the static app, with a preview URL for every pull request |
| Errors and analytics | Sentry (EU region), cookieless analytics (Plausible or PostHog EU) |
| Tooling | pnpm workspaces, Biome, Vitest, Playwright, GitHub Actions |
| Native (later) | Tauri v2 + plugins (Capacitor for mobile stays a fallback, see [§16](#16-risks-to-test-early)) |

### Repo layout

```
meandu/
├─ apps/
│  └─ web/                 # the app (later also src-tauri/ for the native builds)
│     └─ src/
│        ├─ app/           # shell, providers, router
│        ├─ navigation/    # tabs, stacks, sheets, transitions, swipe-back
│        ├─ ui/            # design system: tokens + components
│        ├─ platform/      # web.ts now, tauri.ts later
│        ├─ data/          # local DB schema, sync engine, hooks (useEvents, useList, ...)
│        └─ features/      # today, calendar, lists, memories, onboarding, settings
├─ packages/
│  └─ core/                # pure TS: dates, recurrence, countdowns, ordering, plans, schemas
├─ supabase/
│  ├─ migrations/          # schema, row-level security, sync functions
│  ├─ functions/           # reminder planning, push sending, invites, export / delete
│  └─ tests/               # database tests for security rules and sync
└─ docs/
```

### How data flows

```
You write:        screen → local DB + outbox → sync engine → Supabase (security rules check it)
You read:         screen ← live query ← local DB ← sync_pull ← Supabase
Your partner writes: Supabase → "poke" on your space's realtime channel → your device pulls the change
```

## 6. Data model (v1 sketch)

A **space** is the couple's shared home (solo until the partner joins). All shared data carries `space_id`. IDs are UUIDv7s generated on the device, so things can be created offline. Synced tables also have `created_by`, `created_at`, `updated_at`, `version` and `deleted_at`.

| Table | What it holds |
|---|---|
| `profiles` | Name, avatar, colour, time zone, locale, notification preferences |
| `spaces` | `together_since`, `plan` (free / premium), `sync_version` |
| `space_members` | User ↔ space; at most 2 members per space and 1 space per user |
| `invites` | Short code, expiry, single use |
| `events` | Title, notes, location, emoji / colour; for one partner or both; shared or private; all-day dates or a start / end instant plus an IANA time zone; `rrule`; `kind` (event, birthday, anniversary, special day); `is_countdown` |
| `event_overrides` | Single occurrences of a recurring event that were moved, changed or cancelled |
| `event_reminders` | Per person per event: minutes before |
| `lists`, `list_items` | List type (to-do, groceries, ideas, bucket list), title, emoji; items with text, done by / at, assignee, sort key |
| `memories`, `memory_photos` | Date, note, place, optional linked event; photo paths, dimensions, blur placeholder |
| `push_subscriptions` | Per device (Web Push now, APNs / FCM later); server-side only |
| `scheduled_notifications` | Upcoming reminders ready to send; server-side only |

- Birthdays and anniversaries are yearly all-day events with a `kind`, so they appear in the calendar and can be countdowns and get reminders like everything else. "Days together" comes from `spaces.together_since`.
- Timed events store the exact moment plus the time zone they were planned in; all-day events store plain dates. Partners in different time zones see each other's local time where it matters.

## 7. Sync

Goal: every screen renders from the device, every write is instant, the partner sees changes within about a second, and everything works offline.

**Writing**
1. The UI writes to the local database immediately and adds the change to an **outbox**. Only changed fields are recorded, so two people editing different fields of the same thing don't overwrite each other.
2. The sync engine sends the outbox to Supabase in order. Writes are idempotent (IDs are generated on the device), so retrying after a flaky connection is safe. Row-level security checks every write.
3. If the server rejects a write (for example, the user is no longer in that space), the local change is rolled back and the user gets a gentle message.

**Reading**
1. A database trigger stamps every changed row with its space's next `sync_version`. Because it locks the space row while doing so, versions are committed strictly in order per space, so no change can be skipped.
2. Devices call `sync_pull(since_version)`: one round trip returns every change across all tables. Rows the caller may not see (such as a partner's private event) come back as removals, so turning an event private also removes it from the partner's phone.
3. After each change, the database sends a **poke** (just "version N exists", no data) on the space's private realtime channel, and the partner's device pulls. Realtime never carries content, so it can't leak anything.
4. Deleted rows are kept as tombstones for 30 days; a device that was offline for longer does a full resync.

**Conflicts:** the last write wins, per field. With two people and small amounts of data, that's the right trade-off.

**Housekeeping:** only one browser tab runs the sync loop (Web Locks), and every tab sees changes through Dexie's live queries. Signing out wipes the local database.

**Why our own sync layer and not a sync service:** a space's data is tiny and the rules are simple, so roughly a thousand lines of well-tested code give us full control, no extra vendor in the GDPR setup and no per-connection costs. Everything sits behind our own hooks (`useEvents(range)`, `useList(id)`), so a service like PowerSync (which has a Supabase integration) could replace it later without touching any screens. Also looked at: Zero (1.0 since mid-2026, but it needs its own always-running sync server) and TanStack DB (not stable yet). Both are worth re-checking later.

## 8. Accounts & pairing

**Sign-in**
- **6-digit email codes** everywhere (Supabase Auth OTP), not magic links. On an iPhone a link opens Safari, which doesn't share storage with the installed app, so the user would end up signed in in the wrong place.
- **Apple and Google** are offered where they work reliably: desktop, Android and a regular Safari tab. Redirect-based sign-in inside an installed iOS web app has a history of breaking, so we test it on real devices before showing those buttons there. The native apps use the system sign-in sheets and pass the ID token to Supabase (`signInWithIdToken`). App Store rules require a privacy-friendly option next to Google sign-in, and Sign in with Apple covers that.
- Production needs our own email sender (Supabase's built-in one only works for testing): an EU-based provider, branded templates, SPF / DKIM / DMARC from day one.

**Pairing**
1. Everyone starts with their own space; solo mode is fully usable.
2. "Invite your partner" creates a short code (like `K7P-3QX`), a link and a QR code, shareable through the share sheet. The invite is single use and expires after 7 days.
3. The partner signs in and enters the code or opens the link, which adds them to the space. If they already have solo data, they can bring it along.
4. The code must be easy to type: on an iPhone the installed app can't receive links, so after installing, the partner types the code.

**On iPhones, install first.** When someone opens the site in Safari, onboarding suggests "Add to Home Screen" before signing in, because the installed app has its own storage and push notifications only work there.

**Unlinking**
1. Unlinking **pauses** the space. Nothing is deleted. Shared things are hidden from both partners, and each partner keeps their own private items and can export everything.
2. If both partners agree, relinking brings everything back as it was.
3. **Either partner can ask for deletion** at any time. The other partner is told, and the space is deleted for good after a 30-day grace period, so they can export first.
4. To stay within GDPR's storage limits, a space that has been paused for **24 months** is deleted automatically, after a reminder email to both partners (proposal; easy to change).

## 9. Notifications & reminders

| Kind | Example | Comes from |
|---|---|---|
| Reminder | "Dinner at Luigi's in 30 min" | Scheduled per person |
| Partner activity | "Alex added 'Weekend in Paris'" | A database change, batched over ~2 minutes, respecting quiet hours |
| Special day | "3 days until your anniversary 💛" | Daily planner |
| Milestone | "1,000 days together!" | Daily planner |

**Pipeline**
1. A **planner** (cron, about every 15 minutes, Edge Function) works out upcoming occurrences for the next few days, using the same `packages/core` recurrence code as the app, and writes them to `scheduled_notifications` without duplicates.
2. A **dispatcher** (cron, every minute) sends everything that's due and marks it as sent.
3. **Delivery:** Web Push now (VAPID, with Declarative Web Push payloads for Safari 18.4+), APNs / FCM once the native apps ship.

Reminders are sent from the server because the web has no reliable way to schedule notifications on the device. The native apps will also schedule local notifications.

On iPhones, web push only works in the installed app (iOS 16.4+). We ask for permission at a moment where it clearly helps (for example, right after the first reminder is set), never on first launch.

## 10. Photos (memories)

- Photos are resized on the device (long edge ~2560px, JPEG), plus a thumbnail (~480px) and a tiny blur placeholder (thumbhash) so the grid appears instantly.
- Re-encoding strips the photo's metadata, including GPS location; we read the capture date first and keep it.
- Uploads go through a queue stored on the device, so adding memories offline works.
- Photos live in a private Supabase Storage bucket under `space_id/…`, readable only by the two members, and are shown through short-lived signed links. Thumbnails are cached on the device.
- The free plan gets a generous storage limit per space; more storage or full-resolution originals are premium candidates.

## 11. Native feel: the building blocks

**App shell & CSS base**
- The page itself never scrolls or bounces; each screen scrolls in its own container (`overscroll-behavior`).
- `viewport-fit=cover` with safe-area insets, `dvh` units, layouts that adapt when the keyboard opens.
- No grey tap flash, no long-press callouts or text selection on UI elements, `touch-action: manipulation`, inputs at 16px or larger so iOS doesn't zoom.
- Follows the iOS text-size setting (`-apple-system-body`), uses `ui-rounded`, and supports dark mode via `prefers-color-scheme`.
- The status bar blends into each screen (translucent status bar plus our own header colour).

**Components** (in `ui/` and `navigation/`)

| Component | Behaviour |
|---|---|
| `TabNavigator` | Tabs stay alive with `<Activity>`, keeping scroll position and state; tapping the active tab again scrolls to the top or goes back to the tab's first screen |
| `Stack` | Push / pop transitions; interactive edge swipe-back with the previous screen visible underneath. Only in the installed app and native apps; in a Safari tab, the browser's own back gesture takes over |
| `Sheet` | Snap points, drag to dismiss, smooth hand-off between scrolling and dragging, keyboard-aware, background scales down like on iOS |
| `LargeTitleHeader` | iOS-style large title that collapses into a compact, translucent bar |
| `Pressable` | React Aria press handling (cancels when you start scrolling) with scale feedback and haptics |
| `SwipeActions` | Swipe list rows to complete or delete, with a spring snap |
| `ContextMenu` | Long-press menu with a preview |
| `PullToRefresh`, `SegmentedControl`, `WheelPicker`, `Toast` | The usual native controls, built to the same standard |

**Interaction rules**
- Undo instead of "Are you sure?" dialogs.
- No spinners for your own data; skeletons only on the very first load.
- Animate only `transform` and `opacity`; every spring can be interrupted mid-gesture.
- Haptics go through `platform.haptics`: vibration on Android web, nothing on iOS web, real haptics in the native apps.

**PWA**
- Manifest with maskable icons, iOS icons and splash screens, light / dark theme colours, a "New event" shortcut on Android.
- The app shell is precached, so it starts instantly and works offline. Updates apply on the next launch and never interrupt an edit.
- Installing: Android and desktop use the browser's install prompt; iPhones get our step-by-step guide.

**Budgets**
- At most 250 KB of gzipped JavaScript for the first screen (checked in CI); everything else loads lazily.
- From cache to usable in under 1 second on a mid-range Android phone.
- 60 fps gestures on a cheap Android phone (we test on one).

**Platform layer** (`platform/`)

```ts
interface Platform {
  kind: 'web' | 'pwa' | 'desktop' | 'ios' | 'android'
  haptics: { impact(style: 'light' | 'medium' | 'heavy'): void; notify(type: 'success' | 'warning' | 'error'): void; selection(): void }
  push: { permission(): PermissionState; request(): Promise<boolean>; subscribe(): Promise<void>; unsubscribe(): Promise<void> }
  share(data: ShareData): Promise<void>
  install: { canPrompt: boolean; prompt(): Promise<void>; isInstalled: boolean; needsManualGuide: boolean }
  badge: { set(count: number): void; clear(): void }
  deepLinks: { onOpen(handler: (url: string) => void): () => void }
  secureStore: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> }
  openExternal(url: string): Promise<void>
}
```

## 12. Privacy, security & GDPR

- Data stays in the EU (Supabase Frankfurt), with data processing agreements for every processor (Supabase, Vercel, email provider, Sentry, analytics).
- Row-level security on every table, deny by default. Automated tests cover partners' private events and other couples' data.
- `security definer` database functions pin their `search_path` and check membership explicitly.
- Realtime carries no content; photos are private and served through signed links.
- No ad trackers; cookieless analytics, so likely no cookie banner (to confirm).
- Fonts are self-hosted (loading Google Fonts from Google's servers is a known GDPR problem in the EU).
- In-app data export (JSON + photos) and account deletion, which GDPR requires and the App Store requires too.
- Privacy policy, terms and an imprint (Impressum).
- **Minimum age 14.** Note: in Germany the GDPR age for *consent* (Art. 8) is 16, not 14. So 14 works as long as nothing for under-16s relies on consent: the core app runs on the user agreement, and optional extras like analytics or marketing emails stay off for under-16s. Worth a short legal check before launch.
- Strict Content Security Policy, rate limits on sign-in and invites, secrets only in CI / Vercel / Supabase, two-factor auth on every account, automated dependency updates.

## 13. Quality, CI & environments

**Tests**
- `packages/core`: unit tests plus property-based tests (fast-check) for recurrence, daylight-saving changes, time zones and countdowns.
- Database: pgTAP tests for row-level security, invites and `sync_pull`.
- App: Playwright on iPhone and Pixel screen sizes with both WebKit and Chromium, including a two-partner test (two browser contexts) and an offline-editing test.
- Real devices: every pull request gets a Vercel preview URL to install and try on a phone.

**CI (GitHub Actions)** runs on every pull request: Biome, type check, unit tests, build plus the bundle-size budget, Playwright, database tests.

**Environments**

| | Web | Supabase |
|---|---|---|
| Local | Vite dev server | Supabase CLI (Docker) |
| Preview | Vercel preview per pull request | Staging project (EU) |
| Production | Vercel with a custom domain | Production project (EU) |

CI applies database migrations: to staging on merge, to production on release.

## 14. Running costs (rough)

Prices are approximate and change over time.

| Item | When | Cost |
|---|---|---|
| Supabase | Pro plan for production (free projects pause when inactive and have no backups); staging can stay on the free plan | ~$25 / month |
| Vercel | Hobby is for non-commercial use only, so Pro once this is a business (or Cloudflare Pages) | $0, later ~$20 / month |
| Email sending | EU provider; free tiers cover the start | $0–15 / month |
| Sentry, analytics | Free tiers at first | $0–20 / month |
| Domain | | ~€15 / year |
| Apple Developer Program | Phase 5 | $99 / year |
| Google Play | Phase 5 | $25 once |

## 15. Roadmap

Each phase ends with something usable on a real phone.

**Phase 0: Prototype & design system** (built; now being tried on real phones)
- Monorepo, tooling, CI, Vercel deploys
- Design tokens, CSS base, navigation kit (tabs, stacks, sheets, swipe-back)
- Clickable prototype with demo data that stays on the device: Today, Calendar (month + list), event detail, new-plan sheet, Lists, Memories (with real photos), Settings (language, light/dark)
- Done when: it feels native on your iPhone / Android phone and you love the look

**Phase 1: Foundation**
- Supabase staging + production (EU), schema v1, row-level security with tests
- Email-code sign-in, onboarding, solo mode, pairing (code / link / QR)
- Local database, sync engine, offline outbox, realtime pokes
- PWA: manifest, icons, splash screens, offline shell, update flow, iPhone install guide
- Done when: two paired phones see each other's changes instantly, including after being offline

**Phase 2: Calendar core**
- Events: create / edit / delete, me / partner / us, shared / private, all-day, time zones
- Recurring events with "this / following / all" edits
- Agenda, month, week / 3-day and day views
- Reminders and partner-activity push notifications
- Done when: you'd use it as your real shared calendar

**Phase 3: Couple features**
- Countdowns & special days, days together, milestones; the Today screen
- Shared lists
- Memories with photos (upload queue, offline thumbnails)

**Phase 4: Launch**
- Settings, data export, account deletion, unlinking
- Languages, accessibility pass, performance pass, Sentry and analytics
- Email sending, legal pages, landing page, domain
- Private beta with real couples, then the public web launch

**Phase 5: Native apps (Tauri v2)**
- Desktop builds (macOS / Windows / Linux) with auto-update
- iOS / Android: native push (APNs / FCM), haptics, native Apple / Google sign-in, universal links, Face ID lock, local notifications
- Widgets (Swift / Kotlin), device calendars, and "When are we both free?"
- App Store and Play Store release; premium (in-app purchases, Stripe on the web)

## 16. Risks to test early

| Risk | How we reduce it |
|---|---|
| Quirks of installed web apps on iPhones (social sign-in, push permission, keyboard with sheets, storage) | Real-device checks from Phase 0; email codes as the safe default |
| Sync bugs (offline edits, permission changes, deletions) | A small protocol, database tests, two-partner and offline Playwright tests |
| Recurrence and daylight-saving bugs | Property-based tests in `packages/core` |
| Janky gestures on cheap Android phones | Test on a low-end device; animate only `transform` / `opacity` |
| Gaps in Tauri mobile (no official remote-push plugin yet; widgets need native code) | Re-evaluate at the start of Phase 5; community push plugins exist; Capacitor for mobile is the fallback, and the platform layer makes that a swap, not a rewrite |
| App Store "minimum functionality" rules for web-based apps | Real native value: push, widgets, device calendars, Face ID |
| Sign-in emails landing in spam | A reputable EU sender with SPF / DKIM / DMARC from day one |

## 17. Open questions

- **Name:** is "meandu" the name people will see, or only the working title? (The domain is decided: couple.bojes.org.)
- **Database:** the Supabase free plan on the connected account already has its 2 projects ("blobbase" and "lemon"). For meandu's Frankfurt database, either free a slot or move that Supabase organisation to Pro (~$25/month, needed at launch anyway).
- **Premium:** what's in it, and at what price? (Decide before Phase 5.)
- **"Busy only" events:** v1 or later?

Answered on 2026-10-22: languages (English + German), minimum age (14), unlinking (pause, see [§8](#8-accounts--pairing)).

## 18. References

- Community Tauri push plugins: [tauri-plugin-mobile-push](https://github.com/yanqianglu/tauri-plugin-mobile-push), [tauri-plugin-notifications](https://github.com/Choochmeque/tauri-plugin-notifications)
- [WebKit: Meet Declarative Web Push](https://webkit.org/?p=16535)
- [React 19.2 and `<Activity>`](https://makerkit.dev/blog/tutorials/react-19-2)
- [PowerSync + Supabase](https://docs.powersync.com/integrations/supabase)
- [Zero 1.0 (InfoQ)](https://infoq.com/news/2026/06/zero-version-1)
- [TanStack DB](https://github.com/TanStack/db)
- [OAuth in installed iOS web apps (Firebase issue)](https://github.com/firebase/firebase-js-sdk/issues/77)
