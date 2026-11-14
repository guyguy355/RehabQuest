# Validation

Environment used: Windows 11, Node.js 24.14, npm 11.9, PostgreSQL 16 (Docker Engine inside WSL 2 Ubuntu 22.04,
ports forwarded to Windows), Chromium via Playwright 1.55. Date of the run: 2026-10-12.

## Infrastructure

| Step | Command (folder) | Result |
|---|---|---|
| Start databases | `docker compose up -d` (repo root, run inside WSL) | dev DB on :5432, test DB on :5433 healthy |
| Baseline: old migrations | `npx prisma migrate deploy` (server) | applied |
| Baseline: old test suite | `npm test` (server) | **failed** — test DB was never migrated and the app used the dev DB |
| Data migration check | old migrations + legacy rows (2 active plans, duplicate same-day completions, reset token) on a scratch DB, then the new migration | plans/completions remapped to users, extra active plan paused, duplicate completion removed, token hashed; `prisma migrate diff` against the schema: empty |
| Prepare test DB | `npm run test:db:prepare` (server) | created/marked `rehabquest_test`, migrations applied |
| Migrate dev DB | `npx prisma migrate deploy` (server) | applied |
| Seed | `npm run db:seed` (server), run twice | succeeds, re-runnable |
| Seed guard | `DATABASE_URL=…5433/rehabquest_test npm run db:seed` | refused: "Refusing to seed the test database" |

## Automated checks (final run)

| Check | Command (folder) | Result |
|---|---|---|
| Server type check + build | `npm run build` (server) | pass |
| Server tests | `npm test` (server) | **57 / 57 pass** (15 suites) |
| Client type check + build | `npm run build` (client) | pass |
| Client lint | `npm run lint` (client) | 0 errors, 7 warnings (react-refresh "only export components", dev-only) |
| Browser tests | `npm run test:e2e` (client) | **7 / 7 pass** (6 desktop, 1 mobile Pixel 7) |

### What the server tests cover
- `auth.test.ts` — registration (patient only, role escalation refused, validation, duplicates), login,
  missing/malformed/expired/wrong-signature/wrong-issuer tokens, deleted user, malformed JSON → 400,
  hashed and non-exposed reset tokens, reset revokes earlier tokens and is single-use, rate limiting.
- `authorization.test.ts` — 403 for wrong role; 404 when a therapist changes ids to another therapist's
  patient, plan, record or exercise; a patient cannot complete another patient's task; losing the link
  removes access; linking needs the care code; messages only between linked pairs.
- `workflow.test.ts` — end-to-end API workflow with persistence; symptom stop (no task XP, flagged, streak
  kept); input validation; repeated request → no second record/XP; 8 concurrent identical requests → one
  record, one XP event; last two tasks completed concurrently → one session bonus; DB unique constraint;
  patient-timezone day boundary and rest-day rejection; one active plan under concurrent creates; plan edit
  keeps history; plan validation; concurrent reminder-settings reads.
- `progress.test.ts` — rest days do not break streaks, missed days do, symptom stops count as finished,
  partial past days, task windows, achievements only from prescribed tasks, review rules, local dates.
- `summary.test.ts` — rule-based fallback when unconfigured; valid model draft labelled and references
  resolved; unknown references, wrong shape and unsafe wording (diagnosis, increasing intensity, changing
  the plan) rejected; provider error; timeout with abort; hourly model/total limits (429); model input has no
  name/email/ids; only the requesting therapist's records are used; period validation.
- `test-db-guard.test.ts` — "test" in the name is not enough, remote hosts refused, unmarked DB refused at
  runtime (read-only check against the real dev DB).

### What the browser tests cover
- Patient completes today's session: one exercise stopped for symptoms (pain required), the rest completed,
  one save button double-clicked; completion screen shows the expected XP; state and XP survive a reload;
  exactly one record per exercise.
- Therapist sees the stopped record, drafts a summary (rule-based label shown), marks a report reviewed;
  survives reload.
- Therapist links a patient (wrong code rejected, right code accepted), creates a plan (validation shown),
  the patient signs in and sees the new exercise with the prescribed parameters.
- Wrong password message; a patient visiting `/therapist` is redirected; an invalid token sends the user to
  login with "Your session ended".
- Registration has no role choice, validates the password and lands on the "No plan yet" state with a care code.
- Keyboard: first Tab reaches "Skip to content" with a visible focus outline.
- Mobile (Pixel 7): patient home, progress, session and feedback, therapist list — no horizontal overflow.

Screenshots from the last run are written to `client/test-results/screens/` (desktop and mobile) and were
reviewed manually.

## Bugs found during validation
1. Plan editor showed a task removed today (already completed today) as still active — caught by
   `workflow.test.ts`; fixed.
2. Safety filter missed "increasing the intensity" (matched only "increase") — caught by `summary.test.ts`; fixed.
3. Concurrent first reads of reminder settings returned 500 (Prisma upsert race) — caught by the browser test;
   fixed and covered by an API test.
4. Auto-scrolling the path to today moved the keyboard starting point past the header — caught by the
   keyboard test; replaced with "Show earlier weeks".

## Not verified / remaining limits
- **Live Claude API call:** no API key was used. The provider path is type-checked and its failure handling is
  tested with injected fakes, but a real request/response against the Anthropic API has not been run.
- **Android/Capacitor build and local notifications:** not built or run on a device.
- **Screen readers:** semantics were added (labels, roles, live regions) and keyboard focus was tested, but
  no manual NVDA/VoiceOver pass was done. Colour contrast was chosen against WCAG AA (e.g. white on primary
  ≈ 4.7:1) but not measured with an automated audit tool.
- **Browsers:** only Chromium was automated (no Firefox/Safari run).
- **Docker Desktop on Windows:** not running on this machine; Docker Engine in WSL was used instead.
- **Production deployment:** not attempted (out of scope).
- Legacy mock-data source files are still in the repository (excluded from build/lint); deleting them needs a
  manual step.
