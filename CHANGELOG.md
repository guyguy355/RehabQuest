# Changelog

## Existing before this upgrade

- Express + Prisma + PostgreSQL API with JWT login/registration, `/auth/me`, role middleware.
- Therapist: link patient by email, custom exercise CRUD, ad-hoc exercise assignment (`PatientExercise`),
  patient progress list.
- Patient: list of assigned exercises, mark complete, pain/difficulty feedback, daily goal and streak
  (computed with up to 365 queries), notification preferences, messages with linked therapist.
- Forgot/reset password structure.
- React + Vite + Tailwind client. Most screens (patient dashboard, quest, progress, badges, therapist
  dashboard, patient profile, plan builder, AI summary) used hard-coded mock data.
- PWA and Capacitor Android configuration.
- One test file (`server/tests/auth.test.ts`).

## Changes in this upgrade

### Fixed (bugs and security issues found)
- **Role escalation:** registration accepted `role: "THERAPIST"` from the client. Now patients only; therapists
  are provisioned server-side (`npm run therapist:create`).
- **Linking without consent:** any therapist could attach any patient by email. Linking now requires the
  patient's care code.
- **Tests pointed at the dev database:** the app under test used `DATABASE_URL` from `.env` while the test
  wrote to `rehabquest_test`; the suite could not pass. Tests now run against a verified, marked test DB.
- **Destructive scripts:** `test:db:down` ran `docker compose down -v` (deleting the dev volume); the seed ran
  `deleteMany()` on whole tables. Both now only touch their own data.
- **Wrong status codes:** errors whose message contained "token" became 401 (e.g. malformed JSON → 401).
  Typed `HttpError`s, 400 for bad JSON, 403 for wrong role, 404 for records the caller may not access.
- **Password reset:** tokens were returned in responses whenever `NODE_ENV` was not `production` and stored in
  plain text. Now hashed (SHA-256), exposed only with `DEV_EXPOSE_RESET_TOKENS=true`, and a reset revokes all
  earlier JWTs.
- Reminder settings: concurrent first loads caused a unique-constraint 500 (found by the browser test).
- Short JWT secret accepted; now ≥ 16 characters required. Login timing no longer reveals whether an email exists.

### Added
- Data model: plans with training weekdays (rest days), tasks with active windows (history-preserving edits),
  idempotent completions (unique per task per patient-local day), XP ledger with unique source keys,
  achievements, AI summary audit log, partial unique index for one active plan per patient. Migration
  preserves existing plan/task/completion/reset-token data.
- Transactional completion with per-patient row lock; duplicate, retried and concurrent requests award XP once.
- Patient-local day calculation with explicit timezone rules.
- Therapist review queue, mark reviewed, patient snapshots (adherence, streak, open reports).
- Plan create/update/pause/resume/complete; exercise library with instructions and safety notes.
- Therapist summary draft: Claude-backed (optional) with schema/reference/safety validation, timeout, hourly
  limits and a labelled rule-based fallback.
- Zod request validation with per-field errors; in-memory rate limiting on auth and linking.
- New client: design system, mascot, patient path, session player, completion screen, progress, profile,
  therapist workspace; central API client with consistent 401/403 handling; session restored once.
- Demo seed with fictional therapist(s), patients in different states, history, feedback and badges.
- Docker Compose with separate dev and test databases; e2e uses its own database.
- 57 server tests (unit + API + concurrency), 7 Playwright browser tests (desktop + mobile).
- typescript-eslint so `npm run lint` can parse TypeScript (it could not before).
- Documentation: README, VALIDATION, Hebrew demo and interview guides.

### Removed / superseded
- `PatientExercise` (ad-hoc assignments) and `PatientProfile` tables, replaced by plans. Their rows are dropped
  by the migration.
- Old badge definitions replaced by five plan-based achievements.
- Mock-data screens are no longer routed or built (files still present; see README → Limitations).
