# Implementation status

Branch: `main` on GitHub (`guyguy355/RehabQuest`). Update this file at the end of every stage.

Since 2026-10-21 RehabQuest is built as a **real product for therapists and patients**, not a demo.
Judge every change by production standards: security, privacy of health data, migrations that are safe
for existing data, clinically reviewed content.

## How to resume
1. `docker compose up -d postgres postgres-test` (run where Docker is available; on this machine: inside WSL, and keep a WSL shell open or the VM stops).
2. `cd server && npm install && npm run test:db:prepare && npm test`
3. `cd client && npm install && npm run build && npx playwright test`
4. Continue with the first stage below that is not ✅.

## Stages

| Stage | Scope | Status | Notes |
|---|---|---|---|
| 0 | Audit, branch, baseline checks | ✅ | baseline: 57 server tests, 7 e2e (Chromium) passing |
| 1A | Templates, plan versions, publish/preview, optimistic concurrency | ✅ | migrations 20261013090000–090300 applied to dev + test DBs after a rehearsal on a copy; API tests in tests/authoring.test.ts; e2e: template → preview → publish, stale editor |
| 1B | Guided session player | ✅ | 4 outcomes, reasons, set/rep controls, hold/rest timers (timestamp-based), pause/resume/refresh restore; e2e uses Playwright fake clock |
| 2C | Contextual messaging | ✅ | migration 20261013100000 (rehearsed on a copy, then dev + test); clientMessageId dedupe, context links re-authorized on read, cursor pagination, unread counts, care-ended read-only; polling 30 s / 10 s (ADR-003); tests/messaging.test.ts + e2e/communication.spec.ts |
| 2D | Reminders + notification center + outbox worker | ✅ | DB outbox with SKIP LOCKED, dedupe, backoff; IANA timezone, quiet hours, snooze, DST rules; in-app + optional Web Push (VAPID), dev log adapter; ADR-003; tests/reminders.test.ts, tests/reminder-time.test.ts; e2e checks settings + unconfigured push message |
| 2E | Review workspace | ✅ | ReviewItem with dedupeKey, open/seen/resolved with actor + note, filters, search, cursor, per-therapist rules, missed-activity + unanswered-message rules; ADR-004 for ended care; tests/reviews.test.ts; e2e resolve + filter flow. Fixed a stale-response race in the filter list found by e2e |
| 3F | Goals and milestones | ✅ | migration 20261014090000 (rehearsed on a copy, then dev + test); therapist-confirmed goals/milestones, measurement goals with progress, lockVersion (stale_goal), audit; tests/care.test.ts; e2e confirm milestone |
| 3G | Check-ins, measurements, analytics | ✅ | weekly check-ins (nulls kept), decimal measurements with idempotency, pure weekly analytics (docs/ANALYTICS.md, tests/analytics.test.ts); two single-axis charts + table from the same rows; e2e trends + table |
| 3H | Supportive gamification | ✅ | weekly goal, welcome-back message + achievement, 6 new achievements with written rules (docs/ACHIEVEMENTS.md, tests/gamification.test.ts), mascot looks, history, calm/sound synced to the account (/me/preferences) |
| 3I | Educational cards | ✅ | versioned cards (stale_card), assignments (one active per card+patient), optional exercise link shown in the session, per-version read confirmation, plain-text rendering |
| 3J | 3D exercise demonstrations | ✅ | migration 20261114090000; demo review status, preview mode off in production (EXERCISE_DEMO_PREVIEW); docs/EXERCISE_DEMOS.md |
| 4K | English/Hebrew, RTL, accessibility | ✅ | Hebrew dictionary (client/src/i18n/he.ts) covers the active UI; `npm run i18n:check` is part of CI; logical (start/end) Tailwind classes in the active UI |
| 6N | Production readiness: hosting, email, security, CI, export | ✅ | 2026-11-19. One-container deployment (Dockerfile, render.yaml, docs/DEPLOYMENT.md): API serves the built app, API under /api, in-process worker, `prisma migrate deploy` on start. Password-reset email via Resend (server/src/services/email.ts, bilingual). Startup guard refuses unsafe production config (validateProductionConfig). Security headers + CSP, trust proxy, graceful shutdown. GitHub Actions CI (server tests, client typecheck/lint/i18n/build, Playwright e2e, Docker build). Self-service data export `GET /me/export` (audited). Fixed a latent bug: push jobs were queued with the real clock instead of the worker's clock |
| 4J | PWA + offline outbox | ⏳ | app shell is precached (vite-plugin-pwa); offline recording of exercises is not implemented |
| 5L | Appointment brief | ⏳ | |
| 6M | Demo environment + scenario | ⏳ | demo seed exists (server/prisma/seed.ts); a separate hosted demo is not set up |

## Notes for the next session
- The owner runs `npm run dev` in server/ (port 3000) and Vite (5173/5174). Do not stop them. Because that server
  holds the Prisma engine DLL, `prisma generate` reports EPERM when copying the (identical) DLL; the JS client is
  still regenerated. E2E uses ports 3199/5199 to avoid them.
- In production the client calls `/api` on the same origin (client/src/app/api.ts); in development it calls
  `http://localhost:3000` where the API also answers at the root. Tests use the root paths.
- Production deployment and the operator checklist: docs/DEPLOYMENT.md. The server refuses to start in
  production without email, https APP_BASE_URL and a real secret.
- The login rate limiter is in-memory per process: run one API instance, or add a shared store before scaling out.

- Validation after Stage 2: server 111/111 (node:test), e2e 13/13 (Chromium), client tsc clean, eslint 0 errors (18 react-refresh warnings).
- Validation after Stage 3: server 142/142, e2e 19/19 (Chromium), client tsc clean, eslint 0 errors (22 react-refresh warnings). Dev DB reseeded.
- Validation after 6N/4K (2026-11-19): see VALIDATION.md.

## Open blockers
- Hosting, email domain and the first therapist account need the owner's accounts (Render, Resend, domain). See the
  "What the owner must do" list in docs/GO_LIVE_CHECKLIST.md.
- The exercise catalog and education content need a physiotherapist's review before real patients use them.
