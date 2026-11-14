# RehabQuest

RehabQuest connects physiotherapists and patients around a home-exercise plan.
The therapist prescribes exercises and training days; the patient follows them as
a friendly daily path, reports pain and difficulty after each exercise, and the
therapist reviews the results.

This is a portfolio project. All demo people and records are fictional.

## The main workflow

1. **Therapist** links a patient (patient email + the patient's care code), then creates a plan:
   exercises from their library, sets × reps, seconds per set, training weekdays, dates.
2. **Patient** opens the app and sees today's session and their path. Days that are not training
   days are scheduled rest days.
3. **Patient** does each exercise, then records pain (0–10), difficulty and an optional note — or
   stops because of symptoms. Each exercise is saved immediately.
4. **Server** stores the record, awards XP once, updates the streak and achievements.
5. **Therapist** sees adherence per patient, a queue of flagged reports (stopped, pain ≥ 7, "too hard"),
   each patient's records, and can draft a progress summary (AI-backed or rule-based).

## Features

**Patient**
- Home screen with one clear next action (start / continue / rest day / plan not started / paused).
- Progress path grouped by plan week: finished, today, upcoming, not done, and rest-day stations.
- Session player: therapist parameters and notes, steps, safety notes, set tracker, feedback form.
- "Stop – I have pain or symptoms" path that costs nothing (no XP penalty, streak kept, flagged for review).
- Completion screen with XP earned, streak, plan progress, new achievements and what comes next.
- Progress page: XP, streak, achievements, average-pain chart (with table view), activity history.
- Profile: care code, care team, timezone, daily reminder (Android/Capacitor), messages with therapist.

**Therapist**
- Patient list with plan status, last-7-days adherence, streak, open reports, today's state.
- Patient detail: plan, session calendar, records table with "Mark reviewed", messages, earlier plans.
- Plan editor: create and update plans; removing an exercise keeps its history.
- Exercise library (create, edit, delete when unused).
- Review queue across all linked patients.
- Progress summary draft for 7/14/30 days with references to the underlying records.

## Gamification rules (rehab-appropriate)

- XP only for prescribed tasks: **10 XP** per completed exercise, **+20 XP** when the day's session is finished.
  There is no way to earn XP for extra exercise.
- **Stopping because of symptoms** earns no task XP but still finishes the session (bonus + streak),
  so there is no reason to push through pain.
- **Streak** = planned sessions finished in a row. Rest days are skipped (never break it); today's open
  session does not break it; a past planned day that was not finished does.
- **Achievements** (5): First Step, Steady Rhythm (3 in a row), Full Week, Halfway There, Plan Finisher.
- No leaderboards, no comparison between patients. XP never unlocks exercises; only the therapist changes a plan.

**Daily completion and timezones.** A day is a calendar date in the *patient's* timezone (stored on the
user; sent by the browser at registration; editable on the Profile screen). A completion counts for the
patient-local date on which the server receives it. Only today's prescribed exercises can be completed —
no backfilling, no future days.

**Duplicate protection.** `TaskCompletion` is unique per `(taskId, sessionDate)`; each XP ledger entry has a
unique `sourceKey` (`task:<task>:<date>`, `session:<plan>:<date>`). The completion transaction locks the
patient's row (`SELECT … FOR UPDATE`), so concurrent requests run one after another and the "last task of
the day" check for the session bonus is race-free. Repeats return `200 { alreadyRecorded: true, xpAwarded: 0 }`.

## Architecture

```
client/  React 19 + TypeScript + Vite + Tailwind, React Router; PWA; Capacitor (Android)
  src/app/       API client, auth provider, route guard, shells, router, types
  src/ui/        design system: buttons, fields, progress, pills, dialog, toast, mascot, medals
  src/features/  auth, patient (home, session, complete, progress, profile), therapist (patients,
                 patient detail, plan editor, exercise library, reviews, summary panel)
  e2e/           Playwright browser tests
server/  Express + TypeScript + Prisma + PostgreSQL
  src/app.ts           app factory (dependency injection for the summary model), error handling
  src/auth.ts          JWT signing/verification, revocation on password reset
  src/middleware/      requireAuth / requireRole, rate limiting
  src/routes/          auth, patient, therapist, messages
  src/services/        progress rules (pure), plans + completion transaction, access checks, summary
  prisma/              schema, migrations, demo seed
  tests/               node:test + supertest against a real PostgreSQL test database
```

**Authentication vs. authorization.** Login issues an HS256 JWT (8 h) stored by the client. Every request
reloads the user from the database. Roles come only from the server: public registration always creates a
patient; therapists are provisioned with `npm run therapist:create`. Every route checks the role (403) and
every therapist query checks the therapist–patient link and plan ownership; records the caller may not see
answer 404 so ids cannot be probed. Frontend route guards only improve navigation.

**AI summary.** `POST /therapist/patients/:id/summary` builds a dataset from the requesting therapist's own
plans for that linked patient, pseudonymised (no name/email/ids; records referenced as R1, R2…). If
`AI_SUMMARY_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set, Claude drafts a structured JSON summary.
The output is schema-validated, every reference must exist, and wording that diagnoses or suggests changing
the plan or increasing intensity is rejected. Timeouts, provider errors, refusals, invalid output and hourly
limits fall back to a deterministic rule-based summary that is always labelled as such. Every request is
logged in `AiSummaryRequest`.

## Running locally

Prerequisites: Node.js 22+ (tested with 24), npm, Docker (Docker Desktop on Windows, or Docker Engine in
Ubuntu/WSL).

### Windows PowerShell

```powershell
# 1. Databases (repository root)
cd C:\path\to\RehabQuest
docker compose up -d postgres postgres-test

# 2. API (server folder)
cd server
npm install
Copy-Item .env.example .env        # then set JWT_SECRET in .env
npx prisma migrate deploy
npm run db:seed
npm run dev                        # http://localhost:3000

# 3. Web app (new terminal, client folder)
cd C:\path\to\RehabQuest\client
npm install
npm run dev                        # http://localhost:5173
```

### Ubuntu / WSL (bash)

```bash
# 1. Databases (repository root)
cd ~/RehabQuest          # or /mnt/c/Users/<you>/.../RehabQuest
docker compose up -d postgres postgres-test

# 2. API (server folder)
cd server
npm install
cp .env.example .env
sed -i "s/replace_with_a_long_random_secret/$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")/" .env
npx prisma migrate deploy
npm run db:seed
npm run dev

# 3. Web app (new terminal, client folder)
cd ~/RehabQuest/client
npm install
npm run dev
```

Note: if Docker runs inside WSL but Node runs on Windows, `localhost:5432` is forwarded automatically by WSL 2.
Run `npm install` in the same OS where you run the app (native modules such as bcrypt are OS-specific).

### Demo accounts (password `Demo1234!`)

| Account | Shows |
|---|---|
| `therapist@rehabquest.example` | Dana, 4 linked patients, open reports |
| `maya@rehabquest.example` | patient with a session waiting today, history, badges, a flagged stop |
| `yossi@rehabquest.example` | lower adherence, higher pain, reports to review |
| `rina@rehabquest.example` | plan starts tomorrow |
| `avi@rehabquest.example` | linked, no plan yet |
| `noa@rehabquest.example` | not linked; care code `C0FFEE42` (to demo linking) |
| `therapist2@rehabquest.example` | a second practice (data isolation) |

`npm run db:seed` only deletes and recreates accounts ending in `@rehabquest.example`; other data is not
touched. It refuses to run with `NODE_ENV=production` or against the test database.

### Creating a real therapist account

```bash
cd server
npm run therapist:create -- --name "Full Name" --email person@clinic.example
```

### Enabling the AI summary (optional, synthetic data only)

In `server/.env`: `AI_SUMMARY_PROVIDER="anthropic"` and `ANTHROPIC_API_KEY="..."`. Without them the app works
fully with the rule-based summary.

## Tests

| Command (folder) | What it runs |
|---|---|
| `npm run test:db:prepare` (server) | creates, marks and migrates the isolated test DB (`localhost:5433/rehabquest_test`) |
| `npm test` (server) | 57 API/unit tests against that DB |
| `npm run build` (server, client) | TypeScript build / production bundle |
| `npm run lint` (client) | ESLint with typescript-eslint |
| `npm run test:e2e` (client) | Playwright: full workflow on desktop + mobile; starts its own API on :3100 with its own DB `rehabquest_e2e` |

Test-database safety: the URL must be local and the database named exactly `rehabquest_test`, different from
`DATABASE_URL`, and the connected database must carry a marker comment that only `test:db:prepare` writes.
A URL that merely contains "test" is refused. See [VALIDATION.md](VALIDATION.md) for the latest results.

## Limitations

- Bearer token in `localStorage` (works with the Capacitor app; an httpOnly cookie would resist XSS better).
  Logout is client-side; tokens are revoked server-side only by a password reset.
- No email delivery: password reset tokens are only shown when `DEV_EXPOSE_RESET_TOKENS=true` in development.
- Rate limiting is in memory (per process).
- One active plan per patient. A therapist only sees plans they created, even for a shared patient.
- Changing a plan's training weekdays applies to the whole plan, including past days.
- Reminders are local notifications in the Android build only.
- English only (no RTL UI).
- The live Claude call path is covered with injected fakes in tests; it has not been exercised against the real API here.
- Legacy mock-data screens from the earlier version remain in `client/src/{components,pages,services,types,routes,auth,config}`.
  They are excluded from the build and lint and can be deleted.

## Credits

Icons: [Lucide](https://lucide.dev) (ISC). Fonts: Baloo 2 and Nunito (SIL Open Font License) via Google Fonts.
The mascot "Pip", logo and badge artwork are original to this project.
